const firebaseConfig = {
    apiKey: "AIzaSyCIMRsiTlvJdxwwcxeT-D9oMKcmeF1Xcac",
    authDomain: "matcauvong-app.firebaseapp.com",
    projectId: "matcauvong-app",
    storageBucket: "matcauvong-app.firebasestorage.app",
    messagingSenderId: "586794377316",
    appId: "1:586794377316:web:181f26e23a9cb7f7ce7f71",
    measurementId: "G-3T9HM7GXFV"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
window.db = firebase.firestore();