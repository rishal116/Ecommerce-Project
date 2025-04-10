const express = require("express")
const router = express.Router()
const adminController = require("../controller/admin/adminController")
const customerController = require("../controller/admin/customerController")
const categoryController = require("../controller/admin/categoryController")
const productController = require("../controller/admin/productController")
const brandController = require("../controller/admin/brandController")
const orderController = require("../controller/admin/orderController")
const couponController = require("../controller/admin/couponController")
const dashboardController = require("../controller/admin/dashboardController")
const contactMessageController = require("../controller/admin/contactMessageController")
const walletAdminController =   require("../controller/admin/walletAdminController")
const auth = require("../middlewares/auth")
const multer = require("multer")
const upload = require("../helpers/multer")
const { getContactMessages } = require("../controller/admin/contactMessageController")

router
// Error management
.get("/pageError",adminController.pageError)

// login management
.get("/login",adminController.loadLogin)
.post("/login",adminController.login)
.get("/",auth.adminAuth,adminController.loadDashboard)
.get("/logout",auth.adminAuth,adminController.logout)

// customer management
.get("/users",auth.adminAuth,customerController.customerInfo)
.get("/blockCustomer",auth.adminAuth,customerController.customerBlocked)
.get("/unblockCustomer",auth.adminAuth,customerController.customerunBlock)

// category management
.get("/category",auth.adminAuth,categoryController.categoryInfo)
.post("/addCategory",auth.adminAuth,categoryController.addCategory)
.post("/addCategoryOffer",auth.adminAuth,categoryController.addCategoryOffer)
.post("/removeCategoryOffer",auth.adminAuth,categoryController.removeCategoryOffer)
.get("/listCategory",auth.adminAuth,categoryController.getListCategory)
.get("/unlistCategory",auth.adminAuth,categoryController.getUnlistCategory)
.get("/editCategory",auth.adminAuth,categoryController.getEditCategory)
.post("/editCategory/:id",auth.adminAuth,categoryController.editCategory)

// brand management
.get("/brands",auth.adminAuth,brandController.getBrandPage)
.post("/addBrands",auth.adminAuth,upload.single("image"),brandController.addBrand)
.get("/blockBrand",auth.adminAuth,brandController.blockBrand)
.get("/unblockBrand",auth.adminAuth,brandController.unblockBrand)
.get("/deleteBrand",auth.adminAuth,brandController.deleteBrand)

// product management
.get("/products",auth.adminAuth,productController.productInfo)
.get("/addProducts",auth.adminAuth,productController.getProductAddPage)
.post('/addProducts', upload.array('productImage',10), productController.addProduct)
.get("/blockProduct",auth.adminAuth,productController.blockProduct)
.get("/unblockProduct",auth.adminAuth,productController.unblockProduct)
.get("/editProduct",auth.adminAuth,productController.getEditProduct)
.post("/editProduct/:id",auth.adminAuth,upload.array('productImage',10),productController.editProduct)
.post("/deleteImage",auth.adminAuth,productController.deleteSingleImage)
.post("/addProductOffer",auth.adminAuth,productController.addProductOffer)
.post("/removeProductOffer",auth.adminAuth,productController.removeProductOffer)

// Order Management
.get("/orderList", auth.adminAuth, orderController.getOrderListPageAdmin)
.get("/orderDetailsAdmin/:id", auth.adminAuth, orderController.getOrderDetailsPageAdmin)
.post("/changeStatus", auth.adminAuth, orderController.changeOrderStatus)
.get("/orderList/search",auth.adminAuth,orderController.searchOrders)
.post('/handleReturn',auth.adminAuth,orderController.handleReturn)

// coupon management
.get("/coupon",auth.adminAuth,couponController.loadCoupon)
.post("/createCoupon",auth.adminAuth,couponController.createCoupon)
.put("/editCoupon",auth.adminAuth,couponController.editCoupon)
.delete("/deleteCoupon",auth.adminAuth, couponController.deleteCoupon)
.get("/get-coupon/:couponName", auth.adminAuth,couponController.getCouponDetails)

// dashboard management
.get('/orders/filter',auth.adminAuth, dashboardController.filterOrder)
.get("/orders/report",auth.adminAuth,dashboardController.getOrdersReport)
.get('/orders/download/excel',auth.adminAuth, dashboardController.downloadExcelReport)
.get('/orders/download/pdf', auth.adminAuth, dashboardController.downloadPdfReport)

// contact management
.get("/contactMessages", auth.adminAuth,contactMessageController.getContactMessages)
.delete("/contact/:id",auth.adminAuth,contactMessageController.deleteContactMessage)
.get("/search",auth.adminAuth, contactMessageController.searchMessages)


// wallet management
.get('/transactions', auth.adminAuth,walletAdminController.renderTransactionsPage)
.get('/transaction/:transactionId', auth.adminAuth,walletAdminController.renderTransactionDetailsPage)
.get('/wallet/:userId', auth.adminAuth, walletAdminController.renderWalletPage)



module.exports = router