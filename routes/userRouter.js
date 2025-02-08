const express = require("express")
const router = express.Router()
const userController = require("../controller/user/userController")

router
.get("/pageNotFound",userController.pageNotFound)
.get("/",userController.loadHome)
.get("/signup",userController.loadSignup)
.post("/signup",userController.signup)
.post("/verify-otp",userController.verifyOtp)
.post("/resend-otp",userController.resendOtp)
.get("/login",userController.loadLogin)
.post("/login",userController.login)

module.exports = router