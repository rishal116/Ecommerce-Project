const express = require("express")
const router = express.Router()
const adminController = require("../controller/admin/adminController")
const customerController = require("../controller/admin/customerController")
const categoryController = require("../controller/admin/categoryController")
const productController = require("../controller/admin/productController")
const brandController = require("../controller/admin/brandController")
const auth = require("../middlewares/auth")
const Product = require("../models/productSchema")
const multer = require("multer")
const storage = require("../helpers/multer")
const uploads = multer({storage:storage})

router
// Error management
.get("/pageError",adminController.pageError)
// login management
.get("/login",adminController.loadLogin)
.post("/login",adminController.login)
.get("/",auth.adminAuth,adminController.loadDashboard)
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

// product management
.get("/products",auth.adminAuth,productController.productInfo)
.get("/addProducts",auth.adminAuth,productController.getProductAddPage)
.post("/addProducts",auth.adminAuth,productController.addProduct)




module.exports = router