const User = require("../../models/userSchema") 
const Product = require("../../models/productSchema");
const wishlist = require("../../models/wishlistSchema");


const loadWishlit = async(req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        const products = await Product.find({_id:{$in:userData.wishlist}}).populate("category")
        res.render("wishlist")
        
    } catch (error) {
        
    }
}

module.exports = {
    loadWishlit
}