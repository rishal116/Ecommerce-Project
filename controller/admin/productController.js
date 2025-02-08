const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")


const productInfo = async(req,res)=>{
    try {
        res.render("product")
    } catch (error) {
        console.error(error.message)
        res.redirect("/admin/pageError")
    }
}

const getProductAddPage = async(req,res)=>{
    try {
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})
        res.render("addProduct")
    } catch (error) {
        console.error(error.message)
        res.redirect("/admin/pageError")
    }
}

module.exports = {
    productInfo,
    getProductAddPage,
}