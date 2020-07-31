const mongoose = require("mongoose")
let schema = mongoose.Schema
const autoIncrement = require('mongoose-plugin-autoinc')
const uniqueValidator = require('mongoose-unique-validator');
let pedidoSchema = new schema({
        pedido: {
            type: Number,
            unique: true
        },
        iduser: {
            type: Object
        },
        nombre: {
            type: String,
            // required: [true, 'El título  es requerido']
        },
        apellido: {
            type: String,
            //  required: [true, "El autor es requerido"],
        },
        direccion: {
            type: Object,
            //  required: true
        },
        email: {
            type: String
        },
        productos: {
            type: [Object],
            //   required: true
        },
        fecha: {
            type: Date
        },
        estado: {
            type: Number,
            default: 0
        }
    }, { collection: 'pedidos' })
    //Pendiente de envío
    //Enviado
    //Entredao
pedidoSchema.plugin(autoIncrement.plugin, { model: 'Pedido', field: 'pedido' });
pedidoSchema.plugin(uniqueValidator, { message: `{PATH} debe ser único` })
module.exports = mongoose.model('Pedido', pedidoSchema)