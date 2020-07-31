const mongoose = require("mongoose")
let schema = mongoose.Schema
const uniqueValidator = require('mongoose-unique-validator');
let libroSchema = new schema({
    titulo: {
        type: String,
        // required: [true, 'El título  es requerido']
    },
    autor: {
        type: String,
        //  required: [true, "El autor es requerido"],
    },
    categoria: {
        type: [String],
        //  required: true
    },
    editorial: {
        type: String,
        //   required: true
    },
    descripcion: {
        type: String,
        //  required: true
    },
    precio: {
        type: Number,
        //  required: true
    },
    stock: {
        type: Number,
        //  required: true
    },
    genero: {
        type: [String],
        // required: true
    },
    codigo: {
        type: String,
        //   required: true,
        // unique: true
    },
    formato: {
        type: [String],
        // required: true
    },
    idioma: {
        type: String,
        // required: true
    },
    fecha: {
        type: Number
    },
    img: {
        type: String
    },
    vendidos: {
        type: Number,
        default: 0
    }
}, { collection: 'libros' })

libroSchema.plugin(uniqueValidator, { message: `{PATH} debe ser único` })
module.exports = mongoose.model('Libro', libroSchema)