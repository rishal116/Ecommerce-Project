const User = require("../../models/userSchema") 
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema") 
const Product = require("../../models/productSchema")
const nodemailer = require("nodemailer")
const env = require("dotenv").config()
const bcrypt = require("bcrypt")

const pageNotFound = async(req,res)=> {
    try{
        res.render("userError",{message:"We can't find the page you're looking for."})
    }
    catch(error){
        res.redirect("/pageNotFound")
    }
}

const loadHome = async(req,res)=>{
    try{
        const user = req.session.user
        const category = await Category.find({isListed:true})
        let productData = await Product.find({isBlocked:false,
            category:{$in:category.map(category=> category._id)},
        })

        

        productData.sort((a,b)=> new Date(b.createdAt)- new Date(a.createdAt))
        productData = productData.slice(0,4)

        let userData = null;
        if (user) {
            userData = await User.findById(user).lean();
        }

         return res.render("home", { user: userData, products: productData }); 
    }
    catch(error) {
        console.log("Home Page Not Found");
        res.status(500).send("Server Error")
    }
}

const loadSignup = async(req,res)=>{
    try{
        res.render("signup",{message:null})
    }
    catch(error){
        console.log("Home Page Not Found",error);
        res.status(500).send("Server Error")
    }
}

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString()
}

async function sendVerificationEmail(email, otp) {
    try {
        console.log("Email:", process.env.NODEMAILER_EMAIL);
        console.log("Password:", process.env.NODEMAILER_PASSWORD);

        if (!email) {
            console.error("Error: Email is undefined");
            return false;
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp}</b>`
        };

        const info = await transporter.sendMail(mailOptions); 

        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}


const signup = async (req, res) => {
    try {
        const { name, phone, email, password, confirmPassword } = req.body

        console.log("Received Email:", email) 

        if (!email) {
            return res.render("signup", { message: "Email is required" });
        }

        if (password !== confirmPassword) {
            return res.render("signup", { message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signup", { message: "This email already exists" });
        }

        const otp = generateOtp();
        console.log("Generated OTP:", otp);

        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.render("signup", { message: "Failed to send email. Please try again." });
        }

        req.session.userOtp = otp;
        req.session.userData = { name, phone, email, password };

        res.render("otp", { 
            message: null,
            otp: otp
        });
        console.log("OTP Sent:", otp);
    } catch (error) {
        console.log("Error of save user:", error);
        res.status(500).send("Server Error");
    }
};


const securePassword = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash
    } catch (error) {
        console.error("Error hashing password:", error);
        res.status(500).send("Server Error");
    }
}

const verifyOtp = async (req,res)=>{
    try {
        const {otp} = req.body

        if(parseInt(otp)===parseInt(req.session.userOtp)){
            const user = req.session.userData

            if (!user.password) {
                return res.status(400).json({ success: false, message: "Password is missing in session data." });
            }

            const passwordHash = await securePassword(user.password)
            const existingUser = await User.findOne({ email: user.email });
            if (existingUser) {
                return res.status(400).json({ success: false, message: "Email already registered. Please log in." });
            }
            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
                googleId: null
            })

            await saveUserData.save()
            req.session.user = saveUserData._id
            res.status(201).json({success:true, message: 'Successfully verified'})
        }else{
            res.status(400).json({success:false, message:"Invalid OTP, Please try again"})
        }
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Email already exists. Please log in." });
        }
        console.log("Error OTP verify:",error)
        res.status(500).json({success:false, message:"An error occured"})
    }
}

const resendOtp = async(req,res)=>{
    try {
        if (!req.session.userData) {
            return res.status(400).json({ error: "Session expired or userData is missing." });
        }
        const {email} = req.session.userData
        if(!email){
            return res.status(400).json({success:false,message:"Email is not found in session"})
        }
        const otp = generateOtp()
        req.session.userOtp = otp

        const emailSent = await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log("resend otp",otp);
            res.status(200).json({success:true , message:"OTP resend successfully"})
        }else{
            res.status(500).json({success:false , message:"Failed to resend otp, Please try again"})
        }


    } catch (error) {
        console.error("error resending otp",error)
        res.status(500).json({success:false , message:"Internal server error, Please try again"})
        
    }
}

const loadLogin = async(req,res)=>{
try {

    if (req.session.user) {
        return res.redirect('/')
    }
    
        return res.render("login",{message:null})
} catch (error) {
    res.redirect("/pageNotFound")
}
}

const login = async(req,res)=>{
try {
    const {email,password} = req.body

    if (!email || !password) {
        return res.render("login", { message: "Email and password are required" });
    }

    const findUser = await User.findOne({isAdmin:0,email:email})

    if(!findUser){
        return res.render("login",{message:"User not found"})
    }

    if(findUser.isBlocked){
        return res.render("login",{message:"User is blocked by admin"})
    }

    const passwordMatch = await bcrypt.compare(password,findUser.password)

    if(!passwordMatch){
        return res.render("login",{message:"Incorrect Password"})
    }

    req.session.user = findUser._id
    console.log('post route', req.session.user)
    
    res.redirect("/")
} catch (error) {
    console.log("login error",error);
    res.render("login",{message:"login failed, Please try again"})
 }
}

const logout = async(req,res)=>{
    try {
        req.session.user = undefined
        req.session.userData = undefined
        return res.redirect("/")

    } catch (error) {
        console.log("error in logout:",error);
        res.redirect("/pageNotFound")
        
    }
}

const loadShoppingPage = async(req,res)=>{
    try {
        const user =  req.session.user
        const userData = await User.findOne({_id:user})
        if(user){
        if (userData.isBlocked) {
            req.session.user = undefined
            return res.redirect("/login")
        }
    }
        const categories = await Category.find({isListed:true})
        const categoryIds = categories.map(category=>category._id.toString())
        const page = parseInt(req.query.page)||1
        const limit = 9
        const skip = (page-1)*limit
        const products = await Product.find({
            isBlocked:false,
            category:{$in:categoryIds},
        }).sort({createdAt:-1}).skip(skip).limit(limit)

        const totalProducts = await Product.countDocuments({
            isBlocked:false,
            category:{$in:categoryIds},
        }) 

        const totalPages = Math.ceil(totalProducts/limit)
        const brands = await Brand.find({isBlocked:false})
        const categoryWithIds = categories.map(category => ({
            _id: category._id,
            name: category.name,
            categoryOffer: category.categoryOffer || 0 
        }))
        


        
        res.render("shop",{
            user:userData,
            products:products,
            category:categoryWithIds,
            brand:brands,
            totalProducts:totalProducts,
            currentPage:page,
            totalPages:totalPages,
            sort:null
        })
    } catch (error) {
        console.log("shopping page: ",error)
        res.redirect('/pageNotFound')
    }
}

const filterProduct = async (req, res) => {
    try {
        const { category, brand, sort } = req.query; // Extract sort
        if (category) req.session.category = category;
        if (brand) req.session.brand = brand;

        const user = req.session.user;
        const categoryId = req.session.category;
        const brandId = req.session.brand;
        const findCategory = categoryId ? await Category.findOne({ _id: categoryId }) : null;
        const findBrand = brandId ? await Brand.findOne({ _id: brandId }) : null;
        const brands = await Brand.find({}).lean();
        const categories = await Category.find({ isListed: true });

        const query = {
            isBlocked: false,
            sizes: { $elemMatch: { quantity: { $gt: 0 } } },
        };

        if (findCategory) query.category = findCategory._id;
        if (findBrand) query.brand = findBrand.brandName;

        let findProducts = await Product.find(query).lean();

        // **Sorting Logic**
        if (sort === "priceLowHigh") {
            findProducts.sort((a, b) => a.salePrice - b.salePrice);
        } else if (sort === "priceHighLow") {
            findProducts.sort((a, b) => b.salePrice - a.salePrice);
        } else {
            findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn)); // Newest first
        }

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);

        res.render("shop", {
            user: user ? await User.findOne({ _id: user }) : null,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            selectedCategory: categoryId || null,
            selectedBrand: brandId || null,
            sort, // Pass sort to EJS
        });

    } catch (error) {
        console.error("Filter Product Error:", error);
        res.redirect("/pageNotFound");
    }
};


const searchProducts = async (req, res) => {
    try {
        const { sort } = req.query; // Extract sort
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        let search = req.body.query;
        const brands = await Brand.find({}).lean();
        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map(category => category._id.toString());
        let searchResult = [];

        if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
            searchResult = req.session.filteredProducts.filter(product =>
                product.productName.toLowerCase().includes(search.toLowerCase())
            );
        } else {
            searchResult = await Product.find({
                productName: { $regex: ".*" + search + ".*", $options: "i" },
                isBlocked: false,
                sizes: { $elemMatch: { quantity: { $gt: 0 } } },
                category: { $in: categoryIds }
            }).lean();
        }

        // **Sorting Logic**
        if (sort === "priceLowHigh") {
            searchResult.sort((a, b) => a.salePrice - b.salePrice);
        } else if (sort === "priceHighLow") {
            searchResult.sort((a, b) => b.salePrice - a.salePrice);
        } else {
            searchResult.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn)); // Newest first
        }

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(searchResult.length / itemsPerPage);
        const currentProduct = searchResult.slice(startIndex, endIndex);

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            count: searchResult.length,
            sort, // Pass sort to EJS
        });
    } catch (error) {
        console.error("Search Product Error:", error);
        res.redirect("/pageNotFound");
    }
};


const filterByPrice = async (req, res) => {
    try {
        const { sort } = req.query; // Extract sort
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const brands = await Brand.find({}).lean();
        const categories = await Category.find({ isListed: true }).lean();

        let findProducts = await Product.find({
            salePrice: { $gt: req.query.gt, $lt: req.query.lt },
            isBlocked: false,
            sizes: { $elemMatch: { quantity: { $gt: 0 } } },
        }).lean();

        // **Sorting Logic**
        if (sort === "priceLowHigh") {
            findProducts.sort((a, b) => a.salePrice - b.salePrice);
        } else if (sort === "priceHighLow") {
            findProducts.sort((a, b) => b.salePrice - a.salePrice);
        } else {
            findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn)); // Newest first
        }

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);
        req.session.filteredProducts = findProducts;

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            sort, // Pass sort to EJS
        });
    } catch (error) {
        console.error("Filter By Price Error:", error);
        res.redirect("/pageNotFound");
    }
};


module.exports = {
    loadHome,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadShoppingPage,
    filterProduct,
    searchProducts,
    filterByPrice
}