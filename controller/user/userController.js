const User = require("../../models/userSchema") 
const nodemailer = require("nodemailer")
const env = require("dotenv").config()
const bcrypt = require("bcrypt")



const pageNotFound = async(req,res)=> {
    try{
        res.render("userError",{message:"We can't find the page you're looking for."})
    }
    catch(error){
        res.redirect("/pageNotFound")
    }
}

const loadHome = async(req,res)=>{
    try{
        return res.render("home")
    }
    catch(error) {
        console.log("Home Page Not Found");
        res.status(500).send("Server Error")
    }
}

const loadSignup = async(req,res)=>{
    try{
        res.render("signup",{message:null})
    }
    catch(error){
        console.log("Home Page Not Found",error);
        res.status(500).send("Server Error")
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

        console.log("Sending email to:", email)

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


const signup = async (req, res) => {
    try {
        const { name, phone, email, password, confirmPassword } = req.body;
        console.log(req.body);
        console.log("Received Email:", email);  
        if (!email) {
            return res.render("signup", { message: "Email is required" });
        }

        if (password !== confirmPassword) {
            return res.render("signup", { message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "This email already exists" });
        }

        const otp = generateOtp();
        console.log("Generated OTP:", otp);

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.render("signup", { message: "Failed to send email. Please try again." });
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };

        res.render("otp", { 
            message: null,
            otp: otp
        });
        console.log("OTP Sent:", otp);
    } catch (error) {
        console.log("Error of save user:", error);
        res.status(500).send("Server Error");
    }
};


const securePassword = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash
    } catch (error) {
        console.error("Error hashing password:", error);
        res.status(500).send("Server Error");
    }
}

const verifyOtp = async (req,res)=>{
    try {
        const {otp} = req.body

        if(parseInt(otp)===parseInt(req.session.userOtp)){
            const user = req.session.userData

            if (!user.password) {
                return res.status(400).json({ success: false, message: "Password is missing in session data." });
            }

            console.log('User Data from session:', req.session.userData);

            const passwordHash = await securePassword(user.password)
            const existingUser = await User.findOne({ email: user.email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: "Email already registered. Please log in." });
            }
            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
                googleId: null
            })

            await saveUserData.save()
            req.session.user = saveUserData._id
            res.status(201).json({success:true, message: 'Successfully verified'})
        }else{
            res.status(400).json({success:false, message:"Invalid OTP, Please try again"})
        }
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Email already exists. Please log in." });
        }
        console.log("Error OTP verify:",error)
        res.status(500).json({success:false, message:"An error occured"})
    }
}

const resendOtp = async(req,res)=>{
    try {
        if (!req.session.userData) {
            return res.status(400).json({ error: "Session expired or userData is missing." });
        }
        const {email} = req.session.userData
        if(!email){
            return res.status(400).json({success:false,message:"Email is not found in session"})
        }
        const otp = generateOtp()
        req.session.userOtp = otp

        const emailSent = await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log("resend otp",otp);
            res.status(200).json({success:true , message:"OTP resend successfully"})
        }else{
            res.status(500).json({success:false , message:"Failed to resend otp, Please try again"})
        }


    } catch (error) {
        console.error("error resending otp",error)
        res.status(500).json({success:false , message:"Internal server error, Please try again"})
        
    }
}

const loadLogin = async(req,res)=>{
try {
    if(!req.session.user){
        return res.render("login",{message:null})
    }else{
        res.redirect("/")
    }
} catch (error) {
    res.redirect("/pageNotFound")
}
}

const login = async(req,res)=>{
try {
    const {email,password} = req.body

    if (!email || !password) {
        return res.render("login", { message: "Email and password are required" });
    }

    const findUser = await User.findOne({isAdmin:0,email:email})

    if(!findUser){
        return res.render("login",{message:"User not found"})
    }

    if(findUser.isBlocked){
        return res.render("login",{message:"User is blocked by admin"})
    }

    const passwordMatch = await bcrypt.compare(password,findUser.password)

    if(!passwordMatch){
        return res.render("login",{message:"Incorrect Password"})
    }

    req.session.user = findUser._id
    res.redirect("/")
} catch (error) {
    console.log("login error",error);
    res.render("login",{message:"login failed, Please try again"})
 }
}


module.exports = {
    loadHome,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
}