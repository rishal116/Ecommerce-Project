const Brand = require("../../models/brandSchema")
const Product = require("../../models/productSchema")

const getBrandPage = async(req,res)=>{
    try {
        const page = parseInt(req.query.page) ||1
        const limit = 4
        const skip = (page-1)*limit
        const brandData = await Brand.find({}).sort({createdAt:-1}).skip(skip).limit(limit)
        const totalBrands = await Brand.countDocuments()
        const totalPages = Math.ceil(totalBrands/limit)
        const reverseBrand = brandData.reverse()
        res.render("brand",{
            data:reverseBrand,
            currentPage:page,
            totalPages:totalPages,
            totalBrands:totalBrands,
        })
    } catch (error) {
        console.log("Error in getBrandPage: ",error)
        res.redirect("/admin/pageError")
    }
}

const addBrand = async(req,res)=>{
try {
    const brand = req.body.name
    const findBrand = await Brand.findOne({brandName:brand})
    if(!findBrand){
        if (!req.file) {
            return res.redirect('/admin/brands?error=File upload failed');
        }
        const image = req.file.filename
        const newBrand = await Brand({
            brandName:brand,
            brandImage:image
        })
        await newBrand.save()
        res.redirect('/admin/brands')
    }else{
        res.redirect('/admin/brands?error=Brand already exists');
    }
} catch (error) {
    console.log("Error in addBrand: ",error)
    res.redirect("/admin/pageError")
}
}

const blockBrand = async(req,res)=>{
    try {
        const id = req.query.id
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/brands")
    } catch (error) {
        console.log("Error in blockBrand: ",error)
        res.redirect("/admin/pageError")
    }
}

const unblockBrand = async(req,res)=>{
    try {
        const id = req.query.id
        await Brand.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/brands")
    } catch (error) {
        console.log("Error in unblockBrand: ",error)
        res.redirect("/admin/pageError")
    }
}

const deleteBrand = async(req,res)=>{
    try {
        const {id} = req.query
        if(!id){
            return res.status(400).redirect("/admin/pageError")
        }
        await Brand.deleteOne({_id:id})
        res.redirect("/admin/brands")
    } catch (error) {
        console.log("Error in deleteBrand: ",error)
        res.redirect("/admin/pageError")
    }
}
module.exports = {
    getBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand
}