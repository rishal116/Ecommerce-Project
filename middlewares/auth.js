const User = require("../models/userSchema") 
const Category = require("../models/categorySchema")
const Brand = require("../models/brandSchema") 
const Product = require("../models/productSchema")

const userAuth = async(req,res,next)=>{
    try {
        const user = req.session.user
        const findUser = await User.findOne({_id: user, isBlocked: false})
        const category = await Category.find({isListed:true})
        let productData = await Product.find({isBlocked:false,
            category:{$in:category.map(category=> category._id)},quantity:{$gt:0}
        })
        productData.sort((a,b)=> new Date(b.createdOn)- new Date(a.createdOn))
        productData = productData.slice(0,4)
        let userData = null;
        if (user) {
            userData = await User.findById(user).lean()
        }
        if(req.session.user && findUser){
            next()
        }else{
            req.session.user = undefined
            req.session.userData = undefined
            res.render('home', {
                 user: null, products: productData
            })
        }
    }
    catch (error) {
        console.log(error)
        res.redirect("/pageNotFound")
    }
}

const adminAuth = (req,res,next)=>{
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/login')
        }
        next()

    } catch (error) {
        
        console.log('error while checking the session', error);
        res.redirect('/admin/pageerror')
    }
}



module.exports = {
    userAuth,
    adminAuth,
}