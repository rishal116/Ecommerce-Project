const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")
const mongoose = require("mongoose");

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
        .sort({createdAt:-1})
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
        console.error("Error in productInfo: ",error)
        res.redirect("/admin/pageError")
    }
}

const getProductAddPage = async(req,res)=>{
    try {
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})
        res.render("addProduct",{
            cat:category,
            brand:brand,
        })
    } catch (error) {
        console.error("Error in getProductAddPage: ",error)
        res.redirect("/admin/pageError")
    }
}

const addProduct = async (req, res) => {
    try {
        const products = req.body
        
        const productExits = await Product.findOne({
            productName : products.productName
        })
        
        if(productExits){
            return res.status(400).json({ message: 'Product Already Exists' })
        }
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' })
        }
        
        if (!products.brand || products.brand.trim() === '') {
            return res.status(400).json({ error: "Brand is required" })
        }
        
        const category = await Category.findOne({ name: products.category })
        if (!category) {
            return res.status(400).json({ error: "Invalid category name" })
        }
        
        const images = []
        
        if (req.files && req.files.length > 0) {
            await Promise.all(req.files.map(async (file) => {
                try {
                    const originalImagePath = file.path
                    const outputImagePath = path.join('public', 'uploads', 'product-images', file.filename)
                    const dir = path.join('public', 'uploads', 'product-images')
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true })
                    }
                    await sharp(originalImagePath)
                    .resize(440, 440, { fit: 'cover' })
                    .toFile(outputImagePath)
                    images.push(file.filename)
                
                } catch (err) {
                    console.error(`Error processing image ${file.filename}:`, err)
                }
            }))
        }
        
        let sizesWithQuantities = []
        if (products.sizesWithQuantities) {
            try {
                const parsedSizes = JSON.parse(products.sizesWithQuantities)
                if (typeof parsedSizes !== "object" || Object.keys(parsedSizes).length === 0) {
                    throw new Error("Invalid sizesWithQuantities format")
                }
                sizesWithQuantities = Object.entries(parsedSizes).map(([size, quantity]) => {
                    if (!size || typeof size !== "string" || size.trim() === "") {
                        throw new Error(`Invalid size name: ${size}`)
                    }
                    if (!quantity || isNaN(quantity) || quantity < 0) {
                        throw new Error(`Invalid quantity for size ${size}`)
                    }
                    return { size, quantity: parseInt(quantity, 10) }
                })
            
            } catch (error) {
                return res.status(400).json({ error: "Invalid sizesWithQuantities format" })
            }
        }
        
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: category._id,
            regularPrice: products.regularPrice,
            salePrice: products.regularPrice,
            createdOn: new Date(),
            quantity: products.quantity,
            sizes: sizesWithQuantities,
            color: products.color,
            productImage: images,
            status: "Available",
        })
        
        await newProduct.save()
        return res.redirect('/admin/products')
    } catch (error) {
        console.error("Error in addProduct: ", error)
        return res.redirect("/admin/pageError")
    }
}

const addProductOffer = async(req,res)=>{
    try {
        const {productId,percentage} = req.body
        const findProduct = await Product.findOne({_id:productId})
        const findCategory = await Category.findOne({_id:findProduct.category})
        
        const highestOffer = Math.max(parseInt(percentage),findCategory.categoryOffer)
        findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice * (highestOffer / 100))
        findProduct.productOffer = parseInt(percentage)
        await findProduct.save()
        res.json({status:true})
    } catch (error) {
        res.redirect("/admin/pageError")
        res.status(500).json({status:false ,message:"Intervel server error"})
    }
}

const removeProductOffer = async(req,res)=>{
    try {
        const {productId} = req.body
        const findProduct = await Product.findOne({_id:productId})
        const findCategory = await Category.findOne({_id:findProduct.category})
        findProduct.productOffer = 0
        const categoryOffer = findCategory.categoryOffer || 0
        findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice * (categoryOffer / 100));
        await findProduct.save()
        res.json({status:true})
        
    } catch (error) {
        res.redirect("/admin/pageError")
    }
}
  
const blockProduct = async(req,res)=>{
    try {
        let id = req.query.id
        await Product.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/products")
    } catch (error) {
        console.error("Error in blockProduct: ", error)
        return res.redirect("/admin/pageError")
    }
}

const unblockProduct = async(req,res)=>{
    try {
        let id = req.query.id
        await Product.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/products")
    } catch (error) {
        console.error("Error in unblockProduct: ", error)
        return res.redirect("/admin/pageError")
    }
}

const getEditProduct = async(req,res)=>{
    try {
        const id = req.query.id
        const product = await Product.findOne({_id:id})
        const category = await Category.find({})
        const brand = await Brand.find({})
        
        res.render("editProduct",{
            product:product,
            cat:category,
            brand:brand,
        })
    } catch (error) {
        console.error("Error in getEditProduct: ", error)
        return res.redirect("/admin/pageError")
    }
}

const editProduct = async (req, res) => {
    try {
        const id = req.params.id
        const data = req.body

        let sizes = []
        try {
            if (data.sizesWithQuantities) {
                sizes = JSON.parse(data.sizesWithQuantities).filter(size => size.quantity > 0)
            }
        } catch (parseError) {
            console.error("Error parsing sizesWithQuantities:", parseError)
            return res.redirect("/admin/pageError")
        }
        const categoryId = await Category.findOne({ name: data.category }).select('_id')
        if (!categoryId) {
            console.error("Category not found!")
            return res.json({message:"Category not found!"})
        }
        const updateFields = {
            productName: data.productName,
            description: data.description,
            brand: data.brand,
            category: categoryId._id, 
            regularPrice: data.regularPrice,
            salePrice: data.regularPrice,
            color: data.color,
            sizes: sizes,  
        }

       
        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            console.error("Product not found!")
            return res.redirect("/admin/pageError")
        }

        const images = []
        if (req.files && req.files.length > 0) {
            await Promise.all(req.files.map(async (file) => {
                try {
                    const originalImagePath = file.path
                    const outputImagePath = path.join('public', 'uploads', 'product-images', file.filename)
                    const dir = path.join('public', 'uploads', 'product-images')
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true })
                    }
                    await sharp(originalImagePath)
                    .resize(440, 440, { fit: 'cover' })
                    .toFile(outputImagePath)
                    images.push(file.filename)
                
                } catch (err) {
                    console.error(`Error processing image ${file.filename}:`, err)
                }
            }))
        }

        
        if (images.length > 0) {
            updateFields.productImage = [...existingProduct.productImage, ...images]
        }

        
        await Product.findByIdAndUpdate(id, { $set: updateFields }, { new: true })

        res.redirect("/admin/products")
    } catch (error) {
        console.error("Error in editProduct: ", error)
        return res.redirect("/admin/pageError")
    }
}

const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body
        if (!imageNameToServer || !productIdToServer) {
            return res.status(400).json({ status: false, error: "Missing required fields" })
        }

        const product = await Product.findByIdAndUpdate(productIdToServer, {
            $pull: { productImage: imageNameToServer }
        }, { new: true })

        if (!product) {
            return res.status(404).json({ status: false, error: "Product not found" })
        }

        const imagePath = path.join(__dirname, "../public/uploads/product-images", imageNameToServer)

        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath)
            console.log(`Image ${imageNameToServer} deleted successfully`)
        } else {
            console.log(`Image ${imageNameToServer} not found`)
        }

        res.json({ status: true })
    } catch (error) {
        console.error("Error in deleteSingleImage: ", error)
        res.status(500).json({ status: false, error: "Server error" })
    }
};


module.exports = {
    productInfo,
    getProductAddPage,
    addProduct,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage
}