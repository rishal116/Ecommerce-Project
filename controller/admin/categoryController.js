const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")

const categoryInfo = async(req,res)=>{
    try {
        const page  = parseInt(req.query.page) ||1
        const limit = 3
        const skip = (page-1)*limit

        const categoryData = await Category.find({})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)

        const totalCategories = await Category.countDocuments() 
        const totalPages = Math.ceil(totalCategories/limit)
        
        res.render("category",{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories
        })
    } catch (error) {
        console.log("Error in caategoryInfo: ",error)
        res.redirect("/admin/pageError")
    }
}

const addCategory = async(req,res)=>{
    try {
        const {name,description} = req.body
        if (!name || !description) {
            return res.status(400).json({ error: "Name and description are required" });
        }
        const existingCategory = await Category.findOne({ name: new RegExp(`^${name}$`, "i") })
        if(existingCategory){
            return res.status(400).json({error:"Category already exists"})
        }

        const newCategory = new Category({
            name,
            description,
        })

        await newCategory.save()
        return res.status(201).json({message:"Category added successfully"})

    } catch (error) {
        console.error("Error in addCategory: ", error)
        res.status(500).json({error:"Internal server error"})
    }
}

const addCategoryOffer = async(req,res)=>{
    try {
        const percentage = parseInt(req.body.percentage)
        const categoryId = req.body.categoryId
        const category = await Category.findById(categoryId)
        if(!category){
            return res.status(404).json({status:false , message:"Category not found"})
        }
        const products = await Product.find({category:category._id})
        const hasProductOffer = products.some((product)=> product.productOffer > percentage) 
        if(hasProductOffer){
            return res.json({status:false , message:"Products within this category already have offer "})
        }
        await Category.updateOne({_id:categoryId},{$set:{categoryOffer:percentage}})

        for(let product of products){
            product.productOffer =0
            product.salePrice = product.regularPrice
            await product.save()
        }
        res.json({status:true})
    } catch (error) {
        console.log("Error in addOffer: ", error)
        res.status(500).json({error:"Internal server error"})
    }
}

const removeCategoryOffer = async(req,res)=>{
    try {
        const categoryId = req.body.categoryId
        const category = await Category.findById(categoryId)
        if(!category){
            return res.status(404).json({status:false , message:"Category not found"})
        }
        const percentage = category.categoryOffer
        const products = await Product.find({category:category._id})

        if(products.length>0){
            for(let product of products){
                product.salePrice += Math.floor(product.regularPrice * (percentage/100))
                product.productOffer = 0
                await product.save()
            }
        }
        category.categoryOffer = 0
        await category.save()
        res.json({status:true})
    } catch (error) {
        console.log("Error in removeOffer: ", error)
        res.status(500).json({error:"Internal server error"})
    }
}

const getListCategory = async(req,res)=>{
    try {
        let id = req.query.id
        await Category.updateOne({_id:id},{$set:{isListed:false}})
        res.redirect("/admin/category")
    } catch (error) {
        console.log("Error in getListCategory: ",error)
        res.redirect("/admin/pageError")
    }
}

const getUnlistCategory = async(req,res)=>{
    try {
        let id = req.query.id
        await Category.updateOne({_id:id},{$set:{isListed:true}})
        res.redirect("/admin/category")
    } catch (error) {
        console.log("Error in getUnlistCategory: ",error)
        res.redirect("/admin/pageError")
    }
}

const getEditCategory = async(req,res)=>{
    try {
        const id = req.query.id
        const category = await Category.findOne({_id:id})
        res.render("editCategory",{category:category})
    } catch (error) {
       console.log("Error in getEditCategory: ",error)
        res.redirect("/admin/pageError")
    }
}

const editCategory = async(req,res)=>{
    try {
        const id = req.params.id
        const {categoryName,description} = req.body
    
        const existingCategory = await Category.findOne({name:categoryName})
        
        if(existingCategory){
           return res.status(400).json({error:"Category already exists , Please try another name"})
        } 

        const updateCategory = await Category.findByIdAndUpdate(id,{
            name :categoryName,
            description : description,
        },{new:true})

        if (updateCategory) {
            return res.status(200).json({ message: "Category updated successfully" });
        } else {
            return res.status(404).json({ error: "Category not found" });
        }
    } catch (error) {
        console.log("Error in editCategory: ",error)
        res.redirect("/admin/pageError")
    }
}

module.exports = {
    categoryInfo,
    addCategory,
    addCategoryOffer,
    removeCategoryOffer,
    getListCategory,
    getUnlistCategory,
    getEditCategory,
    editCategory,
}