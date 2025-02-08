const User = require("../models/userSchema") 

const userAuth = (req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then((data)=>{
            if(data && !data.isBlocked){
                next()
            }else{
                res.redirect("/login")
            }
        })
        .catch((error)=>{
            console.log("error in user auth: ",error)
            res.status(500).send("Internal server error")
        })
    }else{
        res.redirect("/")
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