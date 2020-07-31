var myInput = document.getElementById("inputPassword");
var myInput2 = document.getElementById("inputCPassword");
var confmsg = document.getElementById("confmsg")
var letter = document.getElementById("letter");
var capital = document.getElementById("capital");
var number = document.getElementById("number");
var length = document.getElementById("length");
var form = document.getElementById("registerform")

function ConfirmPassword() {
    if (myInput.value == myInput2.value) {
        confmsg.textContent = "Las contraseñas coinciden";
        confmsg.style.color = "green"

        return true
    } else {
        confmsg.textContent = "Las contraseñas no coinciden";
        confmsg.style.color = "red"
        return false
    }
}
// When the user starts to type something inside the password field
myInput.onkeyup = function() {
    // Validate lowercase letters
    var lowerCaseLetters = /[a-z]/g;
    if (myInput.value.match(lowerCaseLetters)) {
        letter.style.color = "green"
            //letter.classList.add("valid");
    } else {
        letter.style.color = "red"
            /*         letter.classList.remove("valid");
                    letter.classList.add("invalid"); */
    }

    // Validate capital letters
    var upperCaseLetters = /[A-Z]/g;
    if (myInput.value.match(upperCaseLetters)) {
        capital.style.color = "green"
    } else {
        capital.style.color = "red"
    }

    // Validate numbers
    var numbers = /[0-9]/g;
    if (myInput.value.match(numbers)) {
        number.style.color = "green"
    } else {
        number.style.color = "red"
    }

    // Validate length
    if (myInput.value.length >= 8) {
        lenght.style.color = "green"
    } else {
        lenght.style.color = "red"
    }
    ConfirmPassword()
}
myInput2.onkeyup = function() {
    ConfirmPassword()
}


function rolec() {
    var selected = document.getElementById("role").selectedIndex
    if (selected == 0) {
        document.getElementById("role").setCustomValidity('Elija un role para el usuario');
    } else {
        document.getElementById("role").setCustomValidity('');
    }
}

function submitvalidate() {
    var password = ConfirmPassword()
    var selected = document.getElementById("role").selectedIndex
    if (password && selected != 0) {
        document.getElementById("role").setCustomValidity('');
        return true
    } else {
        if (selected == 0) {
            document.getElementById("role").setCustomValidity('Elija un role para el usuario');
        } else {
            document.getElementById("role").setCustomValidity('');
        }
        return false
    }
}