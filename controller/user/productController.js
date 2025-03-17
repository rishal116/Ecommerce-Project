const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")

const productDetails = async(req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findById(userId)
        if(userId){
        if (userData.isBlocked) {
            req.session.destroy();
            return res.redirect("/login")
        }
    }
        const productId = req.params.id
        console.log(productId)
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

        const categories = await Category.find({ isListed: true }).lean();
        const findCategory = product.category
        const categoryDiscount = product.category?.categoryOffer || 0;
        const productDiscount =  product.productOffer || 0;
        const maxDiscount =   Math.max(categoryDiscount, productDiscount)
        
        const sizes = product.sizes || [];
        res.render("productDetailPage",{
            user:userData,
            sizes,
            product:product,
            quantity:product.quantity,
            totalOffer:maxDiscount,
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