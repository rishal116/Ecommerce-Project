const express = require("express")
const router = express.Router()
const userController = require("../controller/user/userController")
const productController = require("../controller/user/productController")
const profileController = require("../controller/user/profileController")
const cartController = require("../controller/user/cartController")
const orderController = require("../controller/user/orderController")
const accountController = require("../controller/user/accountController")
const wishlistController = require("../controller/user/wishlistController")
const couponController = require("../controller/user/couponController")
const walletController = require("../controller/user/walletController")
const {userAuth} = require("../middlewares/auth")
const passport = require("passport")

router
.get("/pageNotFound",userController.pageNotFound)
.get("/",userAuth,userController.loadHome)
.get("/logout",userAuth,userController.logout)

// profile management 
.get("/forgot-password",profileController.getForgetPassPage)
.post("/forgot-password-valid",profileController.forgotEmailValid)
.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
.get("/reset-password",profileController.getResetPassPage)
.post("/reset-password", profileController.postNewPassword)
.post("/resend-forgot-otp",profileController.resendOtp)
.get("/account",userAuth,profileController.account)
.get("/myAddress",userAuth,profileController.myAddress)

// Account Management
.get('/userProfile', userAuth, accountController.loadAccount)
.get('/editProfile', userAuth, accountController.loadEditAccount)
.post('/newEmail-verify', userAuth,accountController.verifyOtp)
.patch('/saveEmail',userAuth, accountController.saveEmail)
.post('/saveAccount',userAuth, accountController.saveDetails)
.post("/sendOtp",userAuth,accountController.sendOtp)
.patch("/resetPassword",userAuth,accountController.resetPassword)

.get("/contact",userAuth,accountController.contactUs)

router.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  )
  
router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/signup" }),
    (req, res) => {
      req.session.user = req.user._id;
      res.redirect("/");
    }
  )

.get("/signup",userController.loadSignup)
.post("/signup",userController.signup)
.post("/verify-otp",userController.verifyOtp)
.post("/resend-otp",userController.resendOtp)
.get("/login",userController.loadLogin)
.post("/login",userController.login)

// product management
.get("/productDetails/:id", productController.productDetails)
.get("/shop",userController.loadShoppingPage)
.get("/filter",userController.filterProduct)
.get("/filterPrice",userController.filterByPrice)
.post("/search",userController.searchProducts)

// address management
.post("/addAddress",userAuth,profileController.postAddAddress)
.get("/editAddress",userAuth,profileController.editAddress)
.post("/editAddress",userAuth,profileController.postEditAddress)
.get("/deleteAddress",userAuth,profileController.deleteAddress)
.post("/addAddressCheckout",profileController.addAddressInCheckout)

// Cart Management
.post("/addToCart", userAuth, cartController.addToCart)
.get("/cart", userAuth, cartController.getCartPage)
.post("/changeQuantity", userAuth,cartController.changeQuantity)
.delete("/removeFromCart", userAuth, cartController.deleteProduct)

// Order Management
.get("/checkout", userAuth,orderController.getCheckoutPage)
.get("/payment",userAuth,orderController.loadPayment)
.get('/payment-failure', userAuth, orderController.paymentFailure)
.post("/createOrder",userAuth,orderController.createOrder)
.post("/orderPlaced",userAuth,orderController.orderPlaced)
.get("/orderConformed",userAuth,orderController.orderConformed)
.get('/payment-success', userAuth, orderController.loadPaymentSuccess)

// order section
.get("/myOrders",userAuth,orderController.loadOrders)
.get("/download-invoice/:id",orderController.downloadInvoice)
.get("/orderDetails/:id",userAuth,orderController.loadOrderDetails)
.delete("/orderCancel/:id",userAuth,orderController.orderCancel)
.delete('/productCancel/:orderNumber/:productId',userAuth,orderController.cancelProduct)
.post('/myOrders/return',userAuth, orderController.returnOrder)
.post('/retryPaymentSuccess', userAuth,orderController.retryPayment)
.post('/create-retry-order', userAuth,orderController.createRetryOrder)

// wishlist management
.get("/wishlist",userAuth,wishlistController.loadWishlist)
.post("/addToWishlist",userAuth,wishlistController.addToWishlist)
.get("/removeWishlist",userAuth,wishlistController.removeProduct)
.post("/addToCart",userAuth,cartController.addToCart)

// coupon management
.post('/applyCoupon',userAuth,couponController.applyCoupon)
.patch('/removeCoupon',userAuth,couponController.removeCoupon)

// wallet management
.get('/wallet', userAuth,walletController.loadWallet)
.post('/payWithWallet', userAuth,walletController.payWithWallet)
.post('/add-money', userAuth,walletController.createAddMoneyOrder)
.post('/verify-payment', userAuth,walletController.verifyAddMoneyPayment)

module.exports = router