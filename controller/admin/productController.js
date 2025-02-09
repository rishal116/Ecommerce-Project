const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")


const productInfo = async(req,res)=>{
    try {
        const search = req.query.search || ""
        const page = req.query.page ||1
        const limit = 4

        const productData = await Product.find({
            $or:[
                {productName:{$regex: new RegExp(".*"+search+".*","i")}},
                {brand:{$regex: new RegExp(".*"+search+".*","i")}},
            ]
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .populate('category')
        .exec()

        const count = await Product.find({
            $or:[
                {productName:{$regex: new RegExp(".*"+search+".*","i")}},
                {brand:{$regex: new RegExp(".*"+search+".*","i")}},
            ]
        }).countDocuments()
 
        const totalPages = Math.ceil(count/limit)
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})

        if(category && brand){
            res.render("product",{
                data:productData,
                currentPage:page,
                totalPages:totalPages,
                cat:category,
                brand:brand,
            })
        }else{
            res.render("pageError")
        }
    } catch (error) {
        console.error("product page error",error)
        res.redirect("/admin/pageError")
    }
}

const getProductAddPage = async(req,res)=>{
    try {
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})
        res.render("addProduct",{
            cat:category,
            bra:brand,
        })
    } catch (error) {
        console.error("add product page error",error)
        res.redirect("/admin/pageError")
    }
}

const addProduct = async(req,res)=>{
  try {
    const products = req.body
    const productExists = await Product.findOne({
        productName:product.productName,
    })
    if(!productExists){
        const images = []

        if(req.files && req.files.length>0){
            for(let i=0;i<req.files.length;i++){
                const originalImagePath = req.files[i].path
                const resizesImagePath = path.join('public','uploads','product-image',req.files[i].filename)
                await sharp(originalImagePath).resize({ width: 150, height: 150 }).toFile(resizesImagePath)
                images.push(req.files[i].filename)
            }
        }

        const categoryId = await Category.findOne({name:products.category}) 

        if(!categoryId){
            return res.status(400).json("invalid category name")
        }

        const newProduct = new Product({
            productName:products.productName,
            description:products.description,
            brand:products.brand,
            category:categoryId._id,
            regularPrice:products.regularPrice,
            salePrice:products.salePrice,
            createdOn:new Date(),
            quantity:products.quantity,
            size:products.size,
            color:products.color,
            productImage:images,
            status:"Available",
        })

        await newProduct.save()
        return res.redirect('/admin/addProducts')


    }else{
        res.status(400).json("product already exists, Please try another")
    }


  } catch (error) {
    console.error("add product error",error)
    res.redirect("/admin/pageError")
  }
}

module.exports = {
    productInfo,
    getProductAddPage,
    addProduct,
}