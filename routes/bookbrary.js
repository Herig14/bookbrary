require('../config/config')
const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const date = require('date-and-time');
const mongoose = require('mongoose')
var multer = require("multer");
var upload = multer({ storage: multer.memoryStorage() });
const natural = require('natural')
const sw = require('stopword')
const { jaccard } = require('../ml/jaccard')
const { coseno } = require('../ml/cosine')
const usuario = require('../models/usuario');
const libro = require('../models/libro');
const pedido = require('../models/pedido');

var { havepermissions } = require('../config/validations')

mongoose.connect(process.env.urldb, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true, useFindAndModify: false }, (err, res) => {
        if (err) throw err
        console.log("Base de datos online");
    })
    //mongoose.set('useFindAndModify', false);

app.get('/', (req, res) => {

    let desde = 0
    let hasta = 10
    let isbns = []
    if (req.session.recommended != undefined) {
        req.session.recommended.forEach(function(part, index, book) {
            isbns.push(part.isbn)
        })
    }

    Promise.all([
        libro.find({}, { codigo: 1, titulo: 1, autor: 1, precio: 1, img: 1, stock: 1 }).sort({ vendidos: -1 }).skip(desde).limit(hasta),
        libro.find({
            'codigo': { $in: isbns }
        }),
        libro.find({}, { codigo: 1, titulo: 1, autor: 1, precio: 1, img: 1, stock: 1 }).sort({ $natural: -1 }).skip(desde).limit(hasta),
    ]).then(([books, recbooks, novedades]) => {
        //;
        // 
        books.forEach(function(part, index, book) {
            books[index].preciostr = part.precio.toFixed(2);
            books[index].disp = part.stock > 0 ? true : false
        });
        recbooks.forEach(function(part, index, book) {
            recbooks[index].preciostr = part.precio.toFixed(2);
            recbooks[index].disp = part.stock > 0 ? true : false

        });
        novedades.forEach(function(part, index, book) {
            novedades[index].preciostr = part.precio.toFixed(2);
            novedades[index].disp = part.stock > 0 ? true : false
        });
        //;
        // book.preciostr = book.precio.toFixed(2)
        //;
        res.render('home', {
            loged: req.session.loged,
            nombre: req.session.username,
            libros: books,
            nitems: req.session.nitems,
            admin: req.session.role == 'ADMIN_ROLE' ? true : false,
            recbool: recbooks.length > 0 ? true : false,
            recommended: recbooks ? recbooks : 0,
            novedades

        })
    })
})

app.get('/emails', function(req, res, err) {
    usuario.find({ email: req.query.emailt }, function(error, emails) {
        // ids is an array of all ObjectIds
        if (emails.length == 0) {
            res.json({ exist: false })
        } else {
            res.json({ exist: true })
        }
    });

});
app.get('/isbn', function(req, res, err) { // <-- response is 'res'

    libro.find({ codigo: req.query.codet }, function(error, isbn) {

        if (isbn.length == 0) {
            res.json({ exist: false })
        } else {
            res.json({ exist: true })
        }
        //res.json(emails)
    });
});



app.get('/login', (req, res) => {
    if (req.session.loged) {
        res.redirect('/')
    }
    res.render('login', { ok: true })
})
app.post('/login', async(req, res) => {
    const user = await usuario.findOne({ email: req.body.email.toLowerCase() })
        //, function(err, user) {
    let err = false
    if (err) {
        // console.log("eror base");
    } else {
        if (user) {
            bcrypt.compare(req.body.password, user.password, (err, result) => {
                    if (result) {
                        if (req.session.nitems > 0) {
                            user.carrito.forEach((objeto, index, array) => {
                                const condition = (element) => element.isbn == objeto.isbn;
                                let isincart = req.session.cart.findIndex(condition)
                                    //falta incorporar stock
                                if (isincart >= 0) {
                                    req.session.cart[isincart].cantidad = req.session.cart[isincart].cantidad + objeto.cantidad

                                } else {
                                    req.session.cart.push({ isbn: objeto.isbn, cantidad: objeto.cantidad })
                                }
                            })
                        } else {
                            req.session.cart = user.carrito
                        }
                        req.session.loged = true
                        req.session.role = user.role
                        req.session.nombre = user.nombre
                        req.session.username = user.username
                        req.session.email = user.email
                            //req.session.cart = user.carrito
                        req.session.userid = user._id
                        res.redirect('/')
                    } else {
                        res.render('login', { ok: false })

                    }
                })
                //})
        } else {
            res.render('login', { ok: false })

        }
    }
    //  })


})
app.get('/signup', (req, res) => {
    if (req.session.loged) {
        res.redirect('/')
    } else {
        res.render('signup')
    }

})
app.post('/signup', async(req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        let user = new usuario({
            nombre: req.body.nombre,
            username: req.body.username,
            email: req.body.email.toLowerCase(),
            password: hashedPassword
        })
        user.save()
        res.redirect('/login')
    } catch (error) {
        res.redirect('/signup')
    }

})
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/')

})
app.get('/dashboard', havepermissions, (req, res) => {
    res.redirect('/orders')

})
app.get('/addbook', havepermissions, (req, res) => {
    Promise.all([
        libro.find().distinct('genero'),
        libro.find().distinct('categoria')
    ]).then(([generos, categorias]) => {
        res.render('addbook', { generos: encodeURI(JSON.stringify(generos)), categorias: encodeURI(JSON.stringify(categorias)) })
    });
})

app.post('/addbook', havepermissions, upload.single('image'), (req, res) => {
    const file = req.file.buffer.toString('base64')
    let generos = req.body.generos.split(',')
    let categoria = req.body.categorias.split(',')
    let book = new libro({
        titulo: req.body.titulo,
        autor: req.body.autor,
        categoria: categoria,
        editorial: req.body.editorial,
        descripcion: req.body.descripcion,
        precio: req.body.precio,
        stock: req.body.stock,
        genero: generos,
        codigo: req.body.codigo,
        formato: req.body.formato,
        idioma: req.body.idioma,
        fecha: req.body.fecha,
        img: file
    })
    book.save()
    var string = encodeURIComponent(true);
    res.redirect("/addbook?success=" + string)
})
app.post('/updatebook', havepermissions, (req, res) => {
    let idbook = req.body.idbook
    Promise.all([
        libro.findOne({ _id: idbook }),
        libro.find().distinct('genero'),
        libro.find().distinct('categoria')

    ]).then(([book, generos, categorias]) => {

        res.render('updatebook', { book, libro: encodeURI(JSON.stringify(book)).replace(/'/g, "%27"), generos: encodeURI(JSON.stringify(generos)), categorias: encodeURI(JSON.stringify(categorias)) })
    });


})
app.post('/doupdatebook', [havepermissions, upload.single('image')], (req, res) => {
    let file
    try {
        file = req.file.buffer.toString('base64')

    } catch (error) {
        file = 0
    }
    let book
    let generos = req.body.generos.split(',')
    let categoria = req.body.categorias.split(',')
    if (file == 0) {
        book = {
            titulo: req.body.titulo,
            autor: req.body.autor,
            categoria: categoria,
            editorial: req.body.editorial,
            descripcion: req.body.descripcion,
            precio: req.body.precio,
            stock: req.body.stock,
            genero: generos,
            codigo: req.body.codigo,
            formato: req.body.formato,
            idioma: req.body.idioma,
        }
    } else {
        book = {
            titulo: req.body.titulo,
            autor: req.body.autor,
            categoria: categoria,
            editorial: req.body.editorial,
            descripcion: req.body.descripcion,
            precio: req.body.precio,
            stock: req.body.stock,
            genero: generos,
            codigo: req.body.codigo,
            formato: req.body.formato,
            idioma: req.body.idioma,
            img: file
        }
    }
    let id = req.body.idbook;
    libro.findByIdAndUpdate(id, book, { new: true, runValidators: true, context: 'query' }, (err, usuarioBD) => {
        if (err) {
            //console.log(err);
            return res.redirect("/error")
        }
        var string = encodeURIComponent(true);
        res.redirect("/books?success=" + string)
    })
})
app.get('/books', havepermissions, (req, res) => {
    libro.find({}, { codigo: 1, titulo: 1, autor: 1, categoria: 1, genero: 1, formato: 1, precio: 1, stock: 1 }, (err, books) => {
        let message = false
        if (req.query.success) {
            message = true
        }

        res.render('books', { libros: books, message })
    })
})

app.get('/cart', (req, res) => {
    let isbns = []
    let total = 0
    if (req.session.nitems > 0) {
        req.session.cart.forEach(function(value, i) {
            isbns.push(value.isbn)
        })

        libro.find({
            'codigo': {
                $in: isbns
            }
        }, { titulo: 1, codigo: 1, precio: 1, autor: 1, stock: 1, img: 1 }, function(err, carrito) {
            carrito.forEach(function(value, i) {
                let temp = req.session.cart.find(element => element.isbn == value.codigo)
                let index = req.session.cart.findIndex(element => element.isbn == value.codigo)
                    //;
                if (temp.cantidad < value.stock) {
                    carrito[i].cantidad = temp.cantidad
                } else {
                    carrito[i].cantidad = value.stock

                    req.session.cart[index].cantidad = value.stock
                        //req.session.cart.splice(isincart, 1)
                }
                carrito[i].preciostr = value.precio.toFixed(2);
                total = total + (carrito[i].precio * carrito[i].cantidad)

            });
            req.session.cart = req.session.cart.filter(element => element.cantidad > 0)
            carrito = carrito.filter(element => element.cantidad > 0)
            if (req.session.loged) {
                //sincronizar base de datos
                usuario.findByIdAndUpdate(req.session.userid, { carrito: req.session.cart }, { new: true, runValidators: true, context: 'query' }, (err, user) => {
                    if (err) {
                        // console.log(err);
                        return res.redirect("/error")
                    }
                    // res.json({ nitems: req.session.cart.length, ok: true })
                })

            }

            total = total.toFixed(2)
                //
            if (req.query.ajax == undefined) {
                res.render('cart', {
                    loged: req.session.loged,
                    nombre: req.session.username,
                    nitems: carrito.length,
                    items: carrito,
                    lleno: carrito.length > 0 ? true : false,
                    admin: req.session.role == 'ADMIN_ROLE' ? true : false,
                    total

                })
            } else {
                //    
                res.json({ total })
            }

        })


    } else {
        if (req.query.ajax == undefined) {
            res.render('cart', {
                loged: req.session.loged,
                nombre: req.session.username,
                nitems: req.session.nitems,
                lleno: false,
                admin: req.session.role == 'ADMIN_ROLE' ? true : false
            })
        } else {
            res.json({ total: 0 })
        }
    }



})
app.get('/addcart', async function(req, res, err) { // <-- response is 'res'
    if (req.session.cart == undefined) {
        req.session.cart = [{ isbn: req.query.isbn, cantidad: 1 }]
    } else {
        const condition = (element) => element.isbn == req.query.isbn;
        let isincart = req.session.cart.findIndex(condition)
        if (isincart >= 0) {
            const book = await libro.findOne({ codigo: req.query.isbn }, { stock: 1 })
            if (book.stock >= req.session.cart[isincart].cantidad + 1) {

                if (parseInt(req.query.nbooks) == -1) {
                    req.session.cart[isincart].cantidad++;
                } else {
                    req.session.cart[isincart].cantidad = parseInt(req.query.nbooks)
                }


            }
            //   })

        } else {
            req.session.cart.push({ isbn: req.query.isbn, cantidad: 1 })

        }

    }
    if (req.session.loged) {
        //sincronizar base de datos
        usuario.findByIdAndUpdate(req.session.userid, { carrito: req.session.cart }, { new: true, runValidators: true, context: 'query' }, (err, user) => {
            if (err) {
                //
                return res.redirect("/error")
            }
            // res.json({ nitems: req.session.cart.length, ok: true })
        })

    }
    res.json({ nitems: req.session.cart.length, ok: true })
});

app.get('/removecart', function(req, res, err) {
        const condition = (element) => element.isbn == req.query.isbn;
        const dropitem = req.query.all
        let isincart = req.session.cart.findIndex(condition)
        if (isincart >= 0) {
            if (dropitem) {
                //eliminar producto
                req.session.cart.splice(isincart, 1)
                    //res.json({ ok: true })
            } else {
                req.session.cart[isincart].cantidad--
            }
        }

        if (req.session.loged) {
            //sincronizar base de datos
            usuario.findByIdAndUpdate(req.session.userid, { carrito: req.session.cart }, { new: true, runValidators: true, context: 'query' }, (err, user) => {
                if (err) {
                    //
                    return res.redirect("/error")
                }
                // res.json({ nitems: req.session.cart.length, ok: true })
            })

        }
        res.json({ nitems: req.session.cart.length, ok: true, })
    })
    //havepermissions
app.get('/adduser', havepermissions, (req, res) => {
    res.render('adduser', { message: false })

})
app.post('/adduser', havepermissions, async(req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        let user = new usuario({
            nombre: req.body.nombre,
            username: req.body.username,
            email: req.body.email.toLowerCase(),
            password: hashedPassword,
            role: req.body.role
        })
        user.save()
        res.render('adduser', { message: true })
    } catch (error) {
        res.redirect('/adduser', { message: false })
    }

})
app.post('/updateuser', havepermissions, (req, res) => {
    let iduser = req.body.iduser
    Promise.all([
        usuario.findOne({ _id: iduser }),

    ]).then(([usuario]) => {
        let admin = false
        if (usuario.role == 'ADMIN_ROLE') {
            admin = true
        }

        res.render('updateuser', { usuario, admin, user: !admin })
    });
})
app.get('/users', havepermissions, (req, res) => {
    usuario.find({}, { email: 1, role: 1, nombre: 1, _id: 1 }, (err, users) => {
        let message = false
        if (req.query.success) {
            message = true
        }
        res.render('users', { usuarios: users, message })

    })
})



app.post('/doupdateuser', havepermissions, async(req, res) => {
    if (req.body.password == '') {
        user = {
            nombre: req.body.nombre,
            username: req.body.username,
            role: req.body.role,
            email: req.body.email

        }
        usuario.findByIdAndUpdate(req.body.idusuario, user, { new: true, runValidators: true, context: 'query' }, (err, usuarioBD) => {
            if (err) {
                // 
                return res.redirect("/error")
            }
            var string = encodeURIComponent(true);
            res.redirect("/users?success=" + string)
        })
    } else {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        user = {
            nombre: req.body.nombre,
            username: req.body.username,
            role: req.body.role,
            email: req.body.email,
            password: hashedPassword

        }
        usuario.findByIdAndUpdate(req.body.idusuario, user, { new: true, runValidators: true, context: 'query' }, (err, usuarioBD) => {
            if (err) {
                //  console.log(err);
                return res.redirect("/error")
            }
            var string = encodeURIComponent(true);
            res.redirect("/users?success=" + string)
        })
    }
})

app.post('/search', (req, res) => {
    //;
    let start = Date.now()
    let autores = []
    if (req.body.busqueda.trim().length > 0) {

        //if(req.body.busqueda)
        libro.find({}, { codigo: 1, descripcion: 1, titulo: 1, autor: 1, categoria: 1, genero: 1, formato: 1, precio: 1, stock: 1, img: 1, editorial: 1 }, (err, books) => {
            books.forEach((element, i, myarray) => {
                    //natural.JaroWinklerDistance(v1, v2)


                    books[i].disp = element.stock > 0 ? true : false
                    let consulta = req.body.busqueda
                    var tokenizer = new natural.AggressiveTokenizerEs();
                    let token_title = tokenizer.tokenize(element.titulo)
                    token_title = sw.removeStopwords(token_title, sw.es)
                    let desc = coseno(consulta, element.descripcion)
                    if (desc > 0.05) {
                        desc = 0.11
                    }
                    //
                    token_title.forEach(function(value, i, vector) {
                        vector[i] = natural.PorterStemmerEs.stem(value)
                    });
                    let tittle = natural.DiceCoefficient(consulta, token_title.join(' '))
                    if (tittle < 0.25) {
                        tittle = 0
                    } else {
                        tittle = tittle
                    }
                    let autor = natural.DiceCoefficient(consulta, element.autor)
                    if (autor < 0.3) {
                        autor = 0
                    } else {
                        autor = autor
                    }

                    let categoria = jaccard(consulta, element.categoria.join(' '))
                    let generos = jaccard(consulta, element.genero.join(' '))
                        //let generos = natural.DiceCoefficient(consulta, element.genero.join(' ')) * 0.2
                    let editorial = natural.DiceCoefficient(consulta, element.editorial)
                    if (editorial < 0.3) {
                        editorial = 0
                    } else {
                        editorial = editorial
                    }
                    myarray[i].score = tittle + autor + categoria + desc + generos + editorial
                        //  myarray[i].score = tittle
                })
                //
            books = books.filter(element => element.score > 0.1).sort((a, b) => b.score - a.score)
            books.forEach((element, i, myarray) => {
                books[i].preciostr = element.precio.toFixed(2);
                console.log(element.score);
                console.log(element.editorial);
                const inlist = autores.findIndex(at => at.autor == element.autor)

                if (inlist < 0) {
                    autores.push({ autor: element.autor })
                }
            })
            console.log('________');
            if (books.length == 0) {
                console.log(Date.now() - start);
                res.render('search', {
                    loged: req.session.loged,
                    nombre: req.session.username,
                    nitems: req.session.nitems,
                    admin: req.session.role == 'ADMIN_ROLE' ? true : false,
                    contenido: false

                })
            } else {
                console.log(Date.now() - start);
                res.render('search', {
                    loged: req.session.loged,
                    nombre: req.session.username,
                    libros: books,
                    nitems: req.session.nitems,
                    admin: req.session.role == 'ADMIN_ROLE' ? true : false,
                    autores,
                    contenido: true
                })
            }
        })
    } else {
        res.redirect('/')
    }


})
app.get('/book', (req, res) => {
    let isbns = []
    if (req.session.recommended != undefined) {
        req.session.recommended.forEach(function(part, index, book) {
            isbns.push(part.isbn)
        })
    }
    libro.findOne({ codigo: req.query.isbn }, (err, book) => {

        libro.find({
            $and: [{
                $or: [{ 'autor': book.autor },
                    {
                        'categoria': { $in: book.categoria },
                        'genero': { $in: book.genero }
                    }
                ]
            }, { 'codigo': { $nin: book.codigo } }]
        }, { titulo: 1, codigo: 1, autor: 1, categoria: 1, genero: 1, img: 1, precio: 1, stock: 1 }, function(err, libros) {
            //
            let percent_autor = 0.05
            let percent_genero = 0.5
            let percent_categoria = 0.45
            libros.forEach(function(part, index) {
                let autor1 = part.autor == book.autor ? (percent_autor) : 0
                    //;
                let gen1 = jaccard(part.genero.join(' '), book.genero.join(' ')) * (percent_genero)
                let cat1 = jaccard(part.categoria.join(' '), book.categoria.join(' ')) * (percent_categoria)
                let s1 = (autor1 + gen1 + cat1)
                libros[index].score = s1
                libros[index].preciostr = part.precio.toFixed(2)
                libros[index].disp = part.stock > 0 ? true : false
            });
            libros = libros.sort((a, b) => b.score - a.score).slice(0, 6)
                // 
            if (!book) {
                //  
                res.redirect('/')
                return
            }
            book.preciostr = book.precio.toFixed(2)
            book.disp = book.stock > 0 ? true : false
                //;
            res.render('book', {
                    loged: req.session.loged,
                    nombre: req.session.username,
                    libro: book,
                    nitems: req.session.nitems,
                    admin: req.session.role == 'ADMIN_ROLE' ? true : false,
                    libros
                })
                // res.json({ ok: true })
        })
    })
    req.session.historial.push(req.query.isbn)
    if (req.session.historial.length > 3) {
        req.session.historial.splice(0, 1)
    }
    //ml

    if (req.session.loged) {
        //base
    }
})

app.get('/recommended', async(req, res) => {
    let isbn1 = ''
    let isbn3 = ''
    let isbn2 = '' //libro más reciente
    if (req.session.historial.length < 3) {
        // 
        return
    } else {
        isbn1 = req.session.historial[0]
        isbn2 = req.session.historial[1]
        isbn3 = req.session.historial[2]
            //  
    }

    let [book1, book2, book3] = await Promise.all([
            libro.findOne({ codigo: isbn1 }),
            libro.findOne({ codigo: isbn2 }),
            libro.findOne({ codigo: isbn3 })
        ])
        //.then(([book1, book2, book3]) => {
        /* 
        
         */
    let libros = await libro.find({
            $and: [{
                $or: [{ 'autor': book1.autor }, { 'autor': book2.autor }, { 'autor': book3.autor },
                    {
                        'categoria': { $in: book1.categoria },
                        'categoria': { $in: book2.categoria },
                        'categoria': { $in: book3.categoria },
                        'genero': { $in: book1.genero },
                        'genero': { $in: book2.genero },
                        'genero': { $in: book3.genero }
                    }
                ]
            }, { 'codigo': { $nin: [book1.codigo, book2.codigo, book3.codigo] } }]
        }, { titulo: 1, codigo: 1, autor: 1, categoria: 1, genero: 1 }, function(err, libros) {
            let percent_autor = 0.1
            let percent_genero = 0.5
            let percent_categoria = 0.4
            let scores = []
            libros.forEach(function(part, index, book) {
                let autor1 = part.autor == book1.autor ? (percent_autor) : 0
                let gen1 = jaccard(part.genero.join(' '), book1.genero.join(' ')) * (percent_genero)
                let cat1 = jaccard(part.categoria.join(' '), book1.categoria.join(' ')) * (percent_categoria)
                let s1 = (autor1 + gen1 + cat1) * (1 / 3)

                let autor2 = part.autor == book2.autor ? (percent_autor) : 0
                let gen2 = jaccard(part.genero.join(' '), book2.genero.join(' ')) * (percent_genero)
                let cat2 = jaccard(part.categoria.join(' '), book2.categoria.join(' ')) * (percent_categoria)
                let s2 = (autor2 + gen2 + cat2) * (1 / 3)

                let autor3 = part.autor == book3.autor ? (percent_autor) : 0
                let gen3 = jaccard(part.genero.join(' '), book3.genero.join(' ')) * (percent_genero)
                let cat3 = jaccard(part.categoria.join(' '), book3.categoria.join(' ')) * (percent_categoria)
                let s3 = (autor3 + gen3 + cat3) * (1 / 3)
                scores.push({ score: s1 + s2 + s3, isbn: part.codigo })

            });
            scores = scores.sort((a, b) => b.score - a.score)
            req.session.recommended = scores.slice(0, 6)
                //;

            res.json({ ok: true })
                //res.render("home")
        })
        //  
        // })

})


app.get('/relatedbooks', async(req, res) => {
    let isbn1 = req.query.isbnrel
    let book1 = await libro.findOne({ codigo: isbn1 })
    let librosf = await libro.find({
        $and: [{
            $or: [{ 'autor': book1.autor },
                {
                    'categoria': { $in: book1.categoria },
                    'genero': { $in: book1.genero }
                }
            ]
        }, { 'codigo': { $nin: book1.codigo } }]
    }, { titulo: 1, codigo: 1, autor: 1, categoria: 1, genero: 1 }, function(err, libros) {
        let percent_autor = 0.1
        let percent_genero = 0.5
        let percent_categoria = 0.4
        let scores = []
        libros.forEach(function(part, index, book) {
            let autor1 = part.autor == book1.autor ? (percent_autor) : 0
            let gen1 = jaccard(part.genero.join(' '), book1.genero.join(' ')) * (percent_genero)
            let cat1 = jaccard(part.categoria.join(' '), book1.categoria.join(' ')) * (percent_categoria)
            let s1 = (autor1 + gen1 + cat1) * (1 / 3)
            libros.push({ score: s1 })
        });
        libros = libros.sort((a, b) => b.score - a.score).slice(0, 6)
        res.json({ ok: true })

    })
})

app.get('/profile', (req, res) => {
    if (req.session.loged) {
        /*         usuario.findOne({ _id: iduser }, function(err, user) {
                    res.render('profile', { user, admin, user: !admin })
                }); */
        user = { email: req.session.email, nombre: req.session.nombre, username: req.session.username }
        res.render('profile', {
            loged: req.session.loged,
            nombre: req.session.username,
            nitems: req.session.nitems,
            admin: req.session.role == 'ADMIN_ROLE' ? true : false,
            usuario: user
        })
    } else {
        res.redirect('/')
    }
})
app.post('/change', (req, res) => {
    let iduser = req.session.userid
    switch (req.body.atr) {
        case 'nombre':
            usuario.findByIdAndUpdate(iduser, { nombre: req.body.data }, { new: true, runValidators: true, context: 'query' }, (err, usuarioBD) => {
                if (err) {
                    return res.redirect("/error")
                }
                req.session.nombre = req.body.data
                res.json({ ok: true })
            })
            break;
        case 'username':
            usuario.findByIdAndUpdate(iduser, { username: req.body.data }, { new: true, runValidators: true, context: 'query' }, (err, usuarioBD) => {
                if (err) {
                    return res.redirect("/error")
                }
                req.session.username = req.body.data
                res.json({ ok: true })
            })
            break;
        case 'email':
            usuario.findByIdAndUpdate(iduser, { email: req.body.data }, { new: true, runValidators: true, context: 'query' }, (err, usuarioBD) => {
                if (err) {
                    return res.redirect("/error")
                }
                req.session.email = req.body.data
                res.json({ ok: true })
            })
            break;
        case 'password':
            usuario.findOne({ _id: req.session.userid }, (err, user) => {

                    // const hPassword = await bcrypt.hash(req.body.apassword, 10)
                    bcrypt.compare(req.body.apassword, user.password, (err, result) => {
                        //


                        if (result) {
                            bcrypt.hash(req.body.npassword, 10, function(err, hashedPassword) {

                                usuario.findByIdAndUpdate(iduser, { password: hashedPassword }, { new: true, runValidators: true, context: 'query' }, (err, usuarioBD) => {
                                    if (err) {
                                        return res.redirect("/error")
                                    }
                                    //req.session.email = req.body.data
                                    res.json({ ok: true })
                                })

                            })


                        } else {
                            res.json({ ok: false })
                        }
                    })
                })
                //const hashedPassword = await bcrypt.hash(req.body.password, 10)

            break;
    }

    //let id = req.session.userid
    //;

})
app.post('/dropallcart', (req, res) => {
    //;
    req.session.cart = []
    if (req.session.loged) {
        //sincronizar base de datos
        usuario.findByIdAndUpdate(req.session.userid, { carrito: req.session.cart }, { new: true, runValidators: true, context: 'query' }, (err, user) => {
            if (err) {
                //
                return res.redirect("/error")
            }
        })

    }
    //res.redirect('/thanks')
    res.json({ ok: true })
})
app.get('/thanks', (req, res) => {
    res.render('thanks', {
        loged: req.session.loged,
        nombre: req.session.username,
        nitems: req.session.nitems,
        admin: req.session.role == 'ADMIN_ROLE' ? true : false,

    })
})

app.post('/addorder', async(req, res) => {
    let datos = req.body.details
    let isbns = []
    let cantidades = []
    req.session.cart.forEach(function(value, i) {
        isbns.push(value.isbn)
        cantidades.push(value.cantidad)
    })
    productos = []
    const carrito = await libro.find({
            'codigo': {
                $in: isbns
            }
        }, { titulo: 1, codigo: 1, precio: 1, autor: 1, stock: 1, img: 1 })
        //TODO añadir vendidos

    carrito.forEach(function(value, i) {
        let temp = req.session.cart.find(element => element.isbn == value.codigo)
        productos.push({ codigo: value.codigo, cantidad: temp.cantidad, preciounit: value.precio })
    });
    //  
    let order = new pedido({
        iduser: req.session.userid,
        nombre: datos.payer.name.given_name,
        apellido: datos.payer.name.surname,
        direccion: datos.purchase_units[0].shipping.address,
        email: datos.payer.email_address,
        fecha: datos.create_time,
        productos
    })
    order.save()
    isbns.forEach(function(value, i) {

        libro.findOneAndUpdate({ codigo: value }, { $inc: { stock: -(cantidades[i]), vendidos: cantidades[i] } }, (err, doc) => {
                if (err) {
                    console.log(err);
                }
            })
            //  productos.push()
            //})
    })
    res.json({ ok: true })
        //reducir stock y aumentar vendidos


})
app.post('/changestate', havepermissions, (req, res) => {

    pedido.findOneAndUpdate({ pedido: req.body.pedido }, { estado: req.body.estado }, (err, doc) => {
        if (err) {
            console.log(err);
        }


    })
    res.json({ ok: true })
})

app.get('/orders', havepermissions, (req, res) => {
    pedido.find({}, (err, pedidos) => {
        var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        pedidos.forEach((value, index) => {
            //;
            let total = 0
            value.productos.forEach((value, idx) => {


                //  pedidos[index].productos[idx].precistr = pedidos[index].productos[idx].preciounit.toFixed(2)
                total = total + (value.cantidad * value.preciounit)
            })
            pedidos[index].stzero = value.estado == 0 ? true : false
            pedidos[index].stone = value.estado == 1 ? true : false
            pedidos[index].sttwo = value.estado == 2 ? true : false
            let line1 = value.direccion.address_line_1
            let ara2 = value.direccion.admin_area_2
            let ara1 = value.direccion.admin_area_1
            let postal = value.direccion.postal_code
            pedidos[index].direccionstr = line1 + ", " + ara2 + ", " + ara1 + ", " + postal
            pedidos[index].fechastr = date.format(value.fecha, 'DD/MM/YYYY')
            pedidos[index].total = total.toFixed(2)

        })
        res.render('orders', { pedidos: pedidos })
    })
})
app.post('/invoice', havepermissions, (req, res) => {

    pedido.findOne({ pedido: req.body.pedido }, (err, factura) => {
        factura.stzero = factura.estado == 0 ? true : false
        factura.stone = factura.estado == 1 ? true : false
        factura.sttwo = factura.estado == 2 ? true : false
        let line1 = factura.direccion.address_line_1
        let ara2 = factura.direccion.admin_area_2
        let ara1 = factura.direccion.admin_area_1
        let postal = factura.direccion.postal_code
        factura.direccionstr = line1 + ", " + ara2 + ", " + ara1 + ", " + postal
        factura.fechastr = date.format(factura.fecha, 'DD/MM/YYYY')
        let total = 0
        let isbns = []
        let cantidades = []
        let precios = []
        factura.productos.forEach((value, index) => {


            total = total + (value.cantidad * value.preciounit)
            isbns.push(value.codigo)

            cantidades.push(value.cantidad)
            precios.push(value.preciounit)
        })
        factura.total = total.toFixed(2)
            //;
        libro.find({
            'codigo': { $in: isbns }
        }, (err, libros) => {
            libros.forEach((libro, index) => {
                    const cond = (element) => element == libro.codigo;
                    indice = isbns.findIndex(cond)
                    libro.preciostr = precios[indice].toFixed(2)
                    libro.cantidad = cantidades[indice]

                })
                //
            res.render('invoice', { factura, libros })
        })
    })
})
app.get('/myorders', (req, res) => {
    if (req.session.loged) {
        pedido.find({ iduser: req.session.userid }, (err, pedidos) => {
            var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            pedidos.forEach((value, index) => {
                //;
                let total = 0
                value.productos.forEach((value, idx) => {


                    //   pedidos[index].productos[idx].precistr = pedidos[index].productos[idx].preciounit.toFixed(2)
                    total = total + (value.cantidad * value.preciounit)
                })
                pedidos[index].stzero = value.estado == 0 ? true : false
                pedidos[index].stone = value.estado == 1 ? true : false
                pedidos[index].sttwo = value.estado == 2 ? true : false
                let line1 = value.direccion.address_line_1
                let ara2 = value.direccion.admin_area_2
                let ara1 = value.direccion.admin_area_1
                let postal = value.direccion.postal_code
                pedidos[index].direccionstr = line1 + ", " + ara2 + ", " + ara1 + ", " + postal
                pedidos[index].fechastr = date.format(value.fecha, 'DD/MM/YYYY')
                pedidos[index].total = total.toFixed(2)
            })
            res.render('myorders', {
                loged: req.session.loged,
                nombre: req.session.username,
                nitems: req.session.nitems,
                admin: req.session.role == 'ADMIN_ROLE' ? true : false,
                pedidos: pedidos
            })
        })
    } else {
        res.redirect('/')
    }
})

app.get('/myinvoice', havepermissions, (req, res) => {
    if (req.session.loged) {

        pedido.findOne({ pedido: req.query.pedido, iduser: req.session.userid }, (err, factura) => {
            factura.stzero = factura.estado == 0 ? true : false
            factura.stone = factura.estado == 1 ? true : false
            factura.sttwo = factura.estado == 2 ? true : false
            let line1 = factura.direccion.address_line_1
            let ara2 = factura.direccion.admin_area_2
            let ara1 = factura.direccion.admin_area_1
            let postal = factura.direccion.postal_code
            factura.direccionstr = line1 + ", " + ara2 + ", " + ara1 + ", " + postal
            factura.fechastr = date.format(factura.fecha, 'DD/MM/YYYY')
            let total = 0
            let isbns = []
            let cantidades = []
            let precios = []
            factura.productos.forEach((value, index) => {


                total = total + (value.cantidad * value.preciounit)
                isbns.push(value.codigo)

                cantidades.push(value.cantidad)
                precios.push(value.preciounit)
            })
            factura.total = total.toFixed(2)
                //;
            libro.find({
                'codigo': { $in: isbns }
            }, (err, libros) => {
                libros.forEach((libro, index) => {
                        const cond = (element) => element == libro.codigo;
                        indice = isbns.findIndex(cond)
                        libro.preciostr = precios[indice].toFixed(2)
                        libro.cantidad = cantidades[indice]

                    })
                    //
                res.render('myinvoice', {
                    loged: req.session.loged,
                    nombre: req.session.username,
                    nitems: req.session.nitems,
                    admin: req.session.role == 'ADMIN_ROLE' ? true : false,
                    factura,
                    libros
                })
            })
        })
    } else {
        res.redirect('/')
    }
})
app.get('*', function(req, res) {
    res.redirect('/');
});


//db.getCollection('users').find({'email':'herig14@gmail.com','username':{'$exists':true}})
module.exports = app