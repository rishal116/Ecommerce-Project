const User = require("../../models/userSchema")
const nodemailer = require("nodemailer");
const env = require("dotenv").config()
const bcrypt = require("bcrypt")



const loadAccount = async (req, res) => {
    try {
        const userId = req.session.user 
        const userData = await User.findOne({_id: userId})
        res.render('profile', {
            user: userData
        })
    } catch (error) {
        console.log('error while loading the account page', error);
        res.redirect('/pagenotfound')
    }
}

const loadEditAccount = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findOne({ _id: userId })
        res.render('editProfile', {
            user: userData
        })
    } catch (error) {
        console.log('Error while loading the edit account page', error);
        res.redirect('/pageNotFound')
        
    }
}

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString()
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
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`
        };

        const info = await transporter.sendMail(mailOptions); 

        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}

const sendOtp = async (req, res) => {
    try {
        
        const {newEmail, value} = req.body
        if (value == 'edit') {
            const otp = generateOtp()
            req.session.userOtp = otp
            const findEmail = await User.findOne({email: newEmail})
            if (findEmail) {
                return res.status(500).json({success: false, message: 'Email is already existed!'})
            }
            const emailSent = await sendVerificationEmail(newEmail, otp)
            if (emailSent) {
                console.log('Sended OTP: ', otp)
                res.status(200).json({success: true, message: 'OTP resend Successfully'})
            } else {
                res.status(500).json({success: false, message: 'Falied to resend OTP. Please try again later'})
            }
        }
    } catch (error) {
        console.error('Error while sending otp', error)
        res.status(500).json({success: false, message: 'Internal Server error! please try again later'})
    }
}

const verifyOtp = async (req, res) => {
    try {
        const serverOtp = req.session.userOtp
        const { otpValue } = req.body
        if (parseInt(serverOtp) == parseInt(otpValue)) {
            return res.status(200).json({success: true, message: 'Successfully verified'})
        }
        return res.status(500).json({success: false, message: 'Invalid OTP! Please try again'})
    } catch (error) {
        console.log('error while verifying otp: ', error)
        res.redirect('/pageNotFound')
    }
}

const saveEmail = async (req, res) => {
    try {
        const userId = req.session.user
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" })
        }
        const { newEmail } = req.body
        if (!newEmail) {
            return res.status(400).json({ success: false, message: "New email is required" })
        }

        const changingEmail = await User.updateOne({ _id: userId }, { $set: { email: newEmail } })

        if (changingEmail.modifiedCount > 0) {
            return res.status(200).json({ success: true, message: "Successfully updated email!" })
        }
        
        return res.status(400).json({ success: false, message: "No changes made" })
    } catch (error) {
        console.log("Error while updating email: ", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" })
    }
}

const saveDetails = async (req, res) => {
    try {
        const userId = req.session.user
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" })
        }

        const { fullName, mobile } = req.body
        if (!fullName || !mobile) {
            return res.status(400).json({ success: false, message: "Name and mobile are required" })
        }

        const updateData = await User.updateOne(
            { _id: userId },
            { $set: { name: fullName, phone: mobile } }
        )

        if (updateData.modifiedCount > 0) {
            return res.status(200).json({ success: true, message: "Profile updated successfully" })
        }

        return res.status(400).json({ success: false, message: "No changes detected" })
    } catch (error) {
        console.log("Error while updating user details:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" })
    }
}

const resetPassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body
        const userId = req.session.user

        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: "All fields are required." })
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: "New password must be at least 6 characters long." })
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "New passwords do not match." })
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." })
        }

       
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Old password is incorrect." })
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt)

        user.password = hashedPassword
        await user.save()

        return res.status(200).json({ success: true, message: "Password updated successfully!" })
    } catch (error) {
        console.error("Reset Password Error:", error)
        return res.status(500).json({ success: false, message: "Server error. Please try again later." })
    }
};

const contactUs = async(req,res)=>{
    try {
        res.render("contactUs")
    } catch (error) {
        
    }
}




module.exports = {
    loadAccount,
    loadEditAccount,
    sendOtp,
    verifyOtp,
    saveEmail,
    saveDetails,
    resetPassword,
    contactUs 
}