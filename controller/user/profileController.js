const User = require("../../models/userSchema")
const Address  = require("../../models/addressSchema")
const nodemailer = require("nodemailer")
const bycrpt = require("bcrypt")
const env = require("dotenv").config()
const session = require("express-session")

const getForgetPassPage = async(req,res)=>{
    try {
        res.render("forgotPassword")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

function generateOtp(){
    const digits = "1234567890"
    let otp = ""
    for(let i=0;i<6;i++){
        otp += digits[Math.floor(Math.random()*10)]
    }
    return otp
}

async function sendVerificationEmail(email, otp) {
    try {
        if (!email) {
            console.error("Error: Email is undefined")
            return false
        }
        
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        })
        
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for reset password",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`
        }
        
        const info = await transporter.sendMail(mailOptions)
        return info.accepted.length > 0
    } catch (error) {
        console.error("Error in sendVerificationEmail: ", error)
        return false
    }
}

const securePassword = async(password)=>{
    try {
        const passwordHash = await bycrpt.hash(password,10)
        return passwordHash
    } catch (error) {
        console.error("Error in securePassword: ", error)
        res.render("/pageNotFound")
    }
}

const forgotEmailValid = async(req,res)=>{
    try {
        const {email} = req.body
        const findUser = await User.findOne({email:email})
        if(findUser){
            const otp = generateOtp()
            const emailSent = await sendVerificationEmail(email, otp)
            if(emailSent){
                req.session.userOtp = otp
                req.session.email = email
                res.render("forgotPass-otp")
                console.log("OTP FOR RESET PASS :",otp)
            }else{
                res.json({success:false , message:'Failed to sent otp, Please try again'})
            }
        }else{
            res.render("forgotPassword",{
                message:"User with this email do not exist"
            })
        }
    } catch (error) {
        res.render("/pageNotFound")
    }
}

const verifyForgotPassOtp = async (req, res) => {
    try {
        const { otp } = req.body
        const userOtp = parseInt(otp, 10)
        const sessionOtp = parseInt(req.session.userOtp, 10)
        if (!otp || otp.length !== 6 || isNaN(userOtp)) {
            return res.status(400).json({ success: false, message: "Invalid OTP format" })
        }
        if (userOtp === sessionOtp) {
            return res.json({ success: true, redirectUrl: "/reset-password" })
        } else {
            return res.status(400).json({ success: false, message: "OTP is incorrect" })
        }
    } catch (error) {
        console.error("Error in verifyForgotPassOtp: ", error)
        res.status(500).json({ success: false, message: "An error occurred, please try again" })
    }
}

const getResetPassPage = async(req,res)=>{
    try {
        res.render("resetPassword")
    } catch (error) {
        console.error("Error in getResetPassPage: ",error)
        res.status(500).json({ success: false, message: "An error occurred, please try again" })
    }
}

const postNewPassword = async(req,res)=>{
    try {
        const {newPass1 , newPass2} = req.body
        const email = req.session.email
        if(newPass1===newPass2){
            const passwordHash = await securePassword(newPass1)
            await User.updateOne({email:email},{$set:{password:passwordHash}})
            res.redirect("/login")
        }else{
            res.render("reset-password",{message:"password not match"})
        }
    } catch (error) {
        console.error("Error in postNewPassword: ", error)
        res.status(500).json({ success: false, message: "Internal server error, Please try again" })
    }
}

const resendOtp = async (req, res) => {
    try {
        const otp = generateOtp()
        req.session.userOtp = otp
        const email = req.session.email
        if (!email) {
            console.log("Email not found in session")
            return res.status(400).json({ success: false, message: "Email not found in session" })
        }
        const emailSent = await sendVerificationEmail(email, otp)
        if (emailSent) {
            console.log("Resend OTP:", otp)
            return res.status(200).json({ success: true, message: "OTP resent successfully" })
        } else {
            return res.status(500).json({ success: false, message: "Failed to resend OTP, Please try again" })
        }
    } catch (error) {
        console.error("Error resending OTP:", error)
        return res.status(500).json({ success: false, message: "Internal server error, Please try again" })
    }
}

const account = async(req,res)=>{
    try {
        const userId = req.session.user
       const userData = await User.findOne({_id:userId})
        res.render("account",{user:userData})
    } catch (error) {
        console.error("error account ",error)
        res.redirect("/pageNotFound")
    }
}

// address management 

const myAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        
        // Pagination logic
        const page = parseInt(req.query.page) || 1; // Get current page (default: 1)
        const limit = 5; // Addresses per page
        const skip = (page - 1) * limit; // Calculate skip value

        // Get addresses with pagination
        const addressData = await Address.findOne({ userId: userId });
        const totalAddresses = addressData?.address?.length || 0; // Total address count
        const totalPages = Math.ceil(totalAddresses / limit); // Calculate total pages

        // Slice addresses for pagination
        const paginatedAddresses = addressData?.address.slice(skip, skip + limit) || [];

        res.render("myAddress", {
            user: userData,
            userAddress: {
                address: paginatedAddresses,
                totalPages: totalPages,
                currentPage: page
            }
        });
    } catch (error) {
        console.error("Error in address:", error);
        res.redirect("/pageNotFound");
    }
};


const postAddAddress = async (req, res) => {
    try {
        // Ensure user is authenticated
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }
        const userId = req.session.user

        // Validate request body
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
        if (!addressType || !name || !city || !state || !pincode || !phone) {
            return res.status(400).json({ success: false, message: "Missing required address fields" });
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let userAddress = await Address.findOne({ userId });

        let newAddress = {
            addressType,
            name,
            city,
            landMark,
            state,
            pincode,
            phone,
            altPhone
        };

        if (!userAddress) {
            userAddress = new Address({
                userId,
                address: [newAddress],
            });
            await userAddress.save();
        } else {
            userAddress.address.push(newAddress);
            await userAddress.save();
        }
        return res.redirect("/myAddress")
        
    } catch (error) {
        console.error("Error in postAddAddress:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const editAddress = async(req,res)=>{
    try {
        const addressId = req.query.id
        const user = req.session.user
        const currAddress = await Address.findOne({
            "address._id":addressId,
        })

        if(!currAddress){
            return res.redirect("/pageNotFound")
        }

        const addressData = currAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString()
        })

        if(!addressData){
            return res.redirect("/pageNotFound")
        }
        res.status(200).json({ address: addressData });
    } catch (error) {
        console.error("error editaddress:",error)
        res.redirect("/pageNotFound")
    }
}

const postEditAddress = async (req, res) => {
    try {
        const { addressId, ...updateData } = req.body; // Extract addressId and update fields
        const user = req.session.user;
        console.log("Request Data:", req.body);

        if (!user) {
            return res.redirect("/login"); // Ensure the user is logged in
        }

        // Check if the address exists for the logged-in user
        const findAddress = await Address.findOne({
            userId: user,
            "address._id": addressId,
        });

        console.log("fid",findAddress)

        if (!findAddress) {
            console.log("Address not found");
            return res.redirect("/pageNotFound");
        }

       

        // Build dynamic update object
        let updateFields = {};
        for (let key in updateData) {
            if (updateData[key] !== undefined && updateData[key] !== "") {
                updateFields[`address.$.${key}`] = updateData[key];
            }
        }

        // Ensure there is something to update
        if (Object.keys(updateFields).length === 0) {
            console.log("No changes detected");
            return res.redirect("/myAddress");
        }

        // Perform the update
        const result = await Address.updateOne(
            { userId: user, "address._id": addressId },
            { $set: updateFields }
        );

        if (result.modifiedCount === 0) {
            console.log("Address update failed");
        } else {
            console.log("Address updated successfully");
        }

        res.redirect("/myAddress");

    } catch (error) {
        console.error("Error in postEditAddress:", error);
        res.redirect("/pageNotFound");
    }
};



const deleteAddress = async(req,res)=>{
    try {
        const addressId = req.query.id
        const findAddress = await Address.findOne({"address._id":addressId})
        if(!findAddress){
            return res.status(400).send("Address Not Found")
        }

        await Address.updateOne({
            "address._id":addressId},
            {
                $pull:{
                    address:{
                        _id:addressId
                    }
                }
            })

            res.redirect("/myAddress")
    } catch (error) {
        
    }
}

const addAddressInCheckout = async (req, res) => {
    try {
        const userId = req.session.user; // Get userId from session
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        // Validate required fields
        if (!addressType || !name || !city || !landMark || !state || !pincode || !phone) {
            return res.status(400).json({ error: "All required fields must be filled." });
        }

        // Find user's address document
        let userAddress = await Address.findOne({ userId });

        if (!userAddress) {
            // If no address document exists, create a new one
            userAddress = new Address({
                userId,
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
            });
        } else {
            // Check if the same address already exists (to prevent duplicates)
            const isDuplicate = userAddress.address.some(addr =>
                addr.addressType === addressType &&
                addr.name === name &&
                addr.city === city &&
                addr.landMark === landMark &&
                addr.state === state &&
                addr.pincode === pincode &&
                addr.phone === phone &&
                addr.altPhone === altPhone
            );

            if (!isDuplicate) {
                // If it's not a duplicate, add the new address
                userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            }
        }

        // Save changes
        await userAddress.save();

        // Redirect back to checkout page
        res.redirect("/checkout");
    } catch (error) {
        console.error("Error adding address:", error);
        res.redirect("/pageNotFound");
    }
};
module.exports = {
    getForgetPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    postNewPassword,
    resendOtp,
    account,
    myAddress,
    editAddress, 
    postAddAddress,
    postEditAddress,
    deleteAddress,
    addAddressInCheckout
}