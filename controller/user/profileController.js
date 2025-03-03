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
            console.error("Error: Email is undefined");
            return false;
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
        });

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for reset password",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`
        };

        const info = await transporter.sendMail(mailOptions); 
        console.log("emailsent:",info.messageId)

        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}

const securePassword = async(password)=>{
    try {
        const passwordHash = await bycrpt.hash(password,10)
        return passwordHash
    } catch (error) {
        console.error("Error verifying password:", error);
        res.render("/pageNotFound")
    }
}





const forgotEmailValid = async(req,res)=>{
    try {
        const {email} = req.body
        const findUser = await User.findOne({email:email})
        if(findUser){
            const otp = generateOtp()
            const emailSent = await sendVerificationEmail(email, otp);
            if(emailSent){
                req.session.userOtp = otp
                req.session.email = email
                res.render("forgotPass-otp")
                console.log("OTP FOR RESET PASS :",otp);
                
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
        const { otp } = req.body;

        const userOtp = parseInt(otp, 10);
        const sessionOtp = parseInt(req.session.userOtp, 10);



        if (!otp || otp.length !== 6 || isNaN(userOtp)) {
            return res.status(400).json({ success: false, message: "Invalid OTP format" });
        }

        if (userOtp === sessionOtp) {
            return res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            return res.status(400).json({ success: false, message: "OTP is incorrect" });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error);
        res.status(500).json({ success: false, message: "An error occurred, please try again" });
    }
};


const getResetPassPage = async(req,res)=>{
    try {
        res.render("resetPassword")
    } catch (error) {
        
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
        console.error("Error resending password:", error);
        res.status(500).json({ success: false, message: "Internal server error, Please try again" });
    }
}

const resendOtp = async (req, res) => {
    try {


        const otp = generateOtp();
        req.session.userOtp = otp;

        const email = req.session.email;  
        if (!email) {
            console.log("Email not found in session");
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resend OTP:", otp);
            return res.status(200).json({ success: true, message: "OTP resent successfully" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to resend OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error resending OTP:", error);
        return res.status(500).json({ success: false, message: "Internal server error, Please try again" });
    }
};


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

const myAddress = async(req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        const addressData = await Address.findOne({userId:userId})
        res.render("myAddress",{
            user:userData,
            userAddress:addressData,
        })
    } catch (error) {
        console.error("Error in address:", error);
        res.redirect("/pageNotFound");
    }
}

const addAddress = async(req,res)=>{
    try {
        const user = req.session.user
        res.render("add-address",{user:user})
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const postAddAddress = async(req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findOne({_id:userId})
        const {addressType,name,city,landMark,state,pincode,phone,altPhone} = req.body

        const userAddress = await Address.findOne({userId:userData._id})
        if(!userAddress){
            const newAddress = new Address({
                userId:userData._id,
                address:[{
                    addressType,name,city,landMark,state,pincode,phone,altPhone
                }],
            })

            await newAddress.save()
        }else{
            userAddress.address.push({ addressType,name,city,landMark,state,pincode,phone,altPhone})
            await userAddress.save()
        }

        res.redirect("/myAddress")
    } catch (error) {
        console.error("error addaddress:",error)
        res.redirect("/pageNotFound")
    }
}

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
        res.render("edit-address",{address:addressData,user:user})
    } catch (error) {
        console.error("error editaddress:",error)
        res.redirect("/pageNotFound")
    }
}

const postEditAddress = async(req,res)=>{
    try {
        const data = req.body
        const addressId = req.query.id
        const user = req.session.query
        const findAddress = await Address.findOne({"address._id":addressId})
        if(!findAddress){
            return res.redirect("/pageNotFound")
        }
        await Address.updateOne({
            "address._id":addressId},
            {$set:{
                "address.$":{
                    _id:addressId,
                    addressType:data.addressType,
                    name:data.name,
                    city:data.city,
                    landMark:data.landMark,
                    state:data.state,
                    pincode:data.pincode,
                    phone:data.phone,
                    altPhone:data.altPhone
                }
            }}
        )
        res.redirect("/myAddress")
    } catch (error) {
        console.error("error editaddress:",error)
        res.redirect("/pageNotFound")
    }
}

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
module.exports = {
    getForgetPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    postNewPassword,
    resendOtp,
    account,
    myAddress,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress
}