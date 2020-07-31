const sw = require('stopword')
const { PorterStemmerEs } = require('natural')
    //función de similutud coseno extraída de: https://gist.github.com/tomericco/14b5ceac90d6eed6f9ba6cb5305f8fab
    //agregadas funciones de remover stopwords, realizar stemming y sustituir tildes
function coseno(str1, str2) {


    str1 = str1.toLowerCase()
    str2 = str2.toLowerCase()

    str1 = str1.replace(/á/g, "a")
    str1 = str1.replace(/é/g, "e")
    str1 = str1.replace(/í/g, "i")
    str1 = str1.replace(/ó/g, "o")
    str1 = str1.replace(/ú/g, "u")

    str2 = str2.replace(/á/g, "a")
    str2 = str2.replace(/é/g, "e")
    str2 = str2.replace(/í/g, "i")
    str2 = str2.replace(/ó/g, "o")
    str2 = str2.replace(/ú/g, "u")

    //
    // Preprocess strings and combine words to a unique collection
    //

    let str1Words = str1.trim().split(' ').map(omitPunctuations);
    let str2Words = str2.trim().split(' ').map(omitPunctuations);

    str1Words = sw.removeStopwords(str1Words, sw.es)
    str2Words = sw.removeStopwords(str2Words, sw.es)

    str1Words.forEach(function(value, i, vector) {
        vector[i] = PorterStemmerEs.stem(value)
    });
    str2Words.forEach(function(value, i, vector) {
        vector[i] = PorterStemmerEs.stem(value)
    });


    const allWordsUnique = Array.from(new Set(str1Words.concat(str2Words)));


    //  console.log(str1Words);
    //
    // Calculate IF-IDF algorithm vectors
    //

    const str1Vector = calcTfIdfVectorForDoc(str1Words, [str2Words], allWordsUnique);
    const str2Vector = calcTfIdfVectorForDoc(str2Words, [str1Words], allWordsUnique);


    //
    // Main
    //

    return cosineSimilarity(str1Vector, str2Vector)



    //
    // Main function
    //

    function cosineSimilarity(vec1, vec2) {
        const dotProduct = vec1.map((val, i) => val * vec2[i]).reduce((accum, curr) => accum + curr, 0);
        const vec1Size = calcVectorSize(vec1);
        const vec2Size = calcVectorSize(vec2);

        return dotProduct / (vec1Size * vec2Size);
    };



    //
    // tf-idf algorithm implementation (https://en.wikipedia.org/wiki/Tf%E2%80%93idf)
    //

    function calcTfIdfVectorForDoc(doc, otherDocs, allWordsSet) {
        return Array.from(allWordsSet).map(word => {
            return tf(word, doc) * idf(word, doc, otherDocs);
        });
    };

    function tf(word, doc) {
        const wordOccurences = doc.filter(w => w === word).length;
        return wordOccurences / doc.length;
    };

    function idf(word, doc, otherDocs) {
        const docsContainingWord = [doc].concat(otherDocs).filter(doc => {
            return !!doc.find(w => w === word);
        });

        return (1 + otherDocs.length) / docsContainingWord.length;
    };



    //
    // Helper functions
    //

    function omitPunctuations(word) {
        return word.replace(/[\!\.\,\?\-\?]/gi, '');
    };

    function calcVectorSize(vec) {
        return Math.sqrt(vec.reduce((accum, curr) => accum + Math.pow(curr, 2), 0));
    };
}

module.exports = { coseno }