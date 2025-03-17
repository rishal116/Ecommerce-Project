const Coupon = require("../../models/couponSchema");

const applyCoupon = async (req, res) => {

    try {

        const { productPrice, couponCode } = req.body
        
        const findCoupon = await Coupon.findOne({ name: couponCode })

        if (findCoupon) {

            const findMinimumPrice = findCoupon.minimumPrice

            if (productPrice >= findMinimumPrice) {

                req.session.offerPrice = findCoupon.offerPrice

              

                req.session.appliedCoupon = {
                    couponName: couponCode,
                    couponOfferPrice: findCoupon.offerPrice
                }

                const appliedCoupon = req.session.appliedCoupon
               
                
                
                res.status(200).json({ success: true, message: 'Applied coupon succesfully!', offerPrice: findCoupon.offerPrice })

                return;
            }   

            res.status(400).json({ success: false, message: `You should buy more than ${ findMinimumPrice } in order to apply ${ couponCode }`}) 
            return;    
        }

        res.status(500).json({success: false, message: 'Coupon not found! '})

    } catch (error) {
        console.log('Error while applying the coupon ', error);
        res.redirect('/pageNotFound')
    }
}

const removeCoupon = async (req, res) => {
    try {
       
        if (!req.session) {
            return res.status(400).json({ success: false, message: 'Session not found!' });
        }

        
        req.session.offerPrice = 0;
        req.session.appliedCoupon = undefined
        
        res.status(200).json({
            success: true, 
            message: 'Coupon removed successfully!'
        });

    } catch (error) {
        console.error('Error while removing the coupon:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = {
    applyCoupon,
    removeCoupon
}




