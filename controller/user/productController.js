const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")

const productDetails = async(req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        const productId = req.query.id
        if (!productId || !productId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).send("Invalid product ID");
        }
        const product = await Product.findById(productId).populate("category")
        if (!product) {
            return res.status(404).send("Product not found");
        }

        if (!product || product.isBlocked) {
            return res.status(404).send("Product not available");
        }
        const findCategory = product.category
        const categoryOffer = findCategory?.categoryOffer||0
        const productOffer = product.productOffer||0
        const totalOffer = categoryOffer + productOffer

        product.finalPrice = product.finalPrice || product.salePrice || product.regularPrice || 0;
        const sizes = product.sizes || [];
        res.render("productDetails",{
            user:userData,
            sizes,
            product:product,
            quantity:product.quantity,
            totalOffer:totalOffer,
            category:findCategory,
        })
    } catch (error) {
        console.error("error  in productdetail:",error);
        res.redirect("/pageNotFound")
        
    }
}



module.exports = {
    productDetails,
    
}