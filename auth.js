// Configuration Firebase (la même que dans app.js)
const firebaseConfig = {
    apiKey: "AIzaSyDBFGDo2IEpSUqHNCxwZWBAUZxa8Lq5VpE",
    authDomain: "crm-dealer-mathieu.firebaseapp.com",
    projectId: "crm-dealer-mathieu",
    storageBucket: "crm-dealer-mathieu.firebasestorage.app",
    messagingSenderId: "99774542996",
    appId: "1:99774542996:web:59457e2166c9646a54f081"
};
firebase.initializeApp(firebaseConfig);

// Sélection des éléments de la page login.html
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const errorParagraph = document.getElementById('login-error');

// Écouteur d'événement sur la soumission du formulaire
loginForm.addEventListener('submit', (event) => {
    // Empêche la page de se recharger
    event.preventDefault();

    const email = emailInput.value;
    const password = passwordInput.value;
    errorParagraph.textContent = ''; // Vide le message d'erreur précédent

    // Fonction de Firebase pour connecter un utilisateur
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Connexion réussie !
            console.log('Utilisateur connecté avec succès !', userCredential.user);
            
            // On redirige l'utilisateur vers la page principale du CRM
            window.location.href = 'index.html';
        })
        .catch((error) => {
            // Il y a eu une erreur
            console.error('Erreur de connexion:', error);
            errorParagraph.textContent = 'Email ou mot de passe incorrect.';
        });
});