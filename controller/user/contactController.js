const User = require("../../models/userSchema")
const Contact = require("../../models/contactSchema")
const contactUs = async(req,res)=>{
    try {
        const user = req.session.user
        res.render('contactUs', { 
            messages: {
                success: req.flash('success'),
                error: req.flash('error')
            },user
        }
        )
    } catch (error) {
        
    }
}

const submitContactForm = async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        // Validate required fields
        if (!name || !email || !subject || !message) {
            return res.status(400).send("All required fields must be filled.");
        }

        // Save to database
        const newContact = new Contact({ name, email, phone, subject, message });
        await newContact.save();

        req.flash("success", "Your message has been sent successfully!");
        res.redirect("/contact");
    } catch (error) {
        console.error("Error submitting contact form:", error);
        req.flash("error", "An error occurred. Please try again.");
        res.redirect("/contact");
    }
};

module.exports = {
    contactUs,
    submitContactForm
}