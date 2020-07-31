var islogged = function(req, res, next) {
    if (req.session.loged == undefined) {
        req.session.loged = false
    }
    if (req.session.historial == undefined) {
        req.session.historial = []
    }
    /*     if (req.session.recommended == undefined) {
            req.session.recommended = []
        } */
    if (req.session.role == undefined) {
        req.session.role = 'USER_ROLE'
    }
    /*    if (req.session.role == 'ADMIN_ROLE') {
           req.session.admin = true
       } else {
           req.session.admin = false
       } */
    if (req.session.cart == undefined) {
        req.session.nitems = 0
    } else {
        req.session.nitems = req.session.cart.length
    }
    next()
};

let havepermissions = (req, res, next) => {
    if (req.session.role === 'ADMIN_ROLE') {
        next()
    } else {
        res.redirect('/')
    }
}
module.exports = { islogged, havepermissions }