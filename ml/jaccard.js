const sw = require('stopword')
const { PorterStemmerEs } = require('natural')

function jaccard(a, b) {
    a = a.toLowerCase()
    b = b.toLowerCase()
    a = a.replace(/á/g, "a")
    a = a.replace(/é/g, "e")
    a = a.replace(/í/g, "i")
    a = a.replace(/ó/g, "o")
    a = a.replace(/ú/g, "u")
    b = b.replace(/á/g, "a")
    b = b.replace(/é/g, "e")
    b = b.replace(/í/g, "i")
    b = b.replace(/ó/g, "o")
    b = b.replace(/ú/g, "u")

    let vectora = a.split(' ')
    let vectorb = b.split(' ')
        /*     console.log(vectora)
            console.log(vectorb) */

    vectora = sw.removeStopwords(vectora, sw.es)
    vectorb = sw.removeStopwords(vectorb, sw.es)

    vectora.forEach(function(value, i, vector) {
        vector[i] = PorterStemmerEs.stem(value)
    });
    vectorb.forEach(function(value, i, vector) {
        vector[i] = PorterStemmerEs.stem(value)
    });

    let aset = new Set(vectora)
    let bset = new Set(vectorb)
    let numerador = new Set([...aset].filter(x => bset.has(x)))
    let denominador = new Set([...aset, ...bset])
    let jaccard = numerador.size / denominador.size
    return jaccard
}
module.exports = { jaccard }