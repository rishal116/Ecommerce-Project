const User = require("../../models/userSchema") 
const Product = require("../../models/productSchema");
const Wishlist = require("../../models/wishlistSchema");
const Cart = require("../../models/cartSchema")
const mongoose = require("mongoose");

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.status(404).send("User not found");
        }

        const page = parseInt(req.query.page) || 1;  
        const limit = 8;  
        const skip = (page - 1) * limit;

        const totalProducts = userData.wishlist.length;
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({ _id: { $in: userData.wishlist } })
            .populate("category")
            .skip(skip)
            .limit(limit);

        res.render("wishlist", { products, user: userData, totalPages, currentPage: page });
    } catch (error) {
        console.error("Error loading wishlist:", error);
        res.status(500).send("Internal Server Error");
    }
};


const addToWishlist = async(req,res)=>{
    try {
        const productId = req.body.productId
        const userId = req.session.user
        if (!userId) {
            return res.redirect('/login'); 
        }
        const userData = await User.findById(userId)
        if(userData.wishlist.includes(productId)){
            return res.status(200).json({status:false ,message:"Product already in wishlist"})
        }


        let wishlistData = await Wishlist.findOne({ userId });

        if (!wishlistData) {
            wishlistData = new Wishlist({
                userId: userId,
                products: [{ productId: productId }]
            });
        } else {
            const alreadyExists = wishlistData.products.some(p => p.productId.equals(productId));
            if (alreadyExists) {
                return res.status(200).json({ status: false, message: "Product already in wishlist" });
            }

            wishlistData.products.push({ productId: productId });
        }

        await wishlistData.save()

        if (!userData.wishlist.includes(productId)) {
            userData.wishlist.push(productId);
            await userData.save();
        }
        return res.status(200).json({status:true,message:"Product added to wishlist"})
    } catch (error) {
        console.error("Error in addToWishlist:", error);
        res.status(500).send("Internal Server Error");
    }
}

const removeProduct = async(req,res)=>{
    try {
        const productId = req.query.productId
        const userId = req.session.user
        const user = await User.findById(userId)
        const index = user.wishlist.indexOf(productId)
        user.wishlist.splice(index,1)
        await user.save()
        await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId } } },
            { new: true }
        );

       return res.redirect("/wishlist")

        
    } catch (error) {
        console.error("Error removing product from wishlist:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}


module.exports = {
    loadWishlist,
    addToWishlist,
    removeProduct,
}