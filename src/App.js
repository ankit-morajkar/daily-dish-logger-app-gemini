/* global __app_id, __firebase_config, __initial_auth_token */
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Firebase configuration for local development.
// IMPORTANT: Replace these placeholder values with your actual Firebase project configuration.
// You can find this in your Firebase project settings -> Project settings -> Your apps -> Web app -> Config.
// Import the functions you need from the SDKs you need
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const localFirebaseConfig = {
  apiKey: "AIzaSyD69skA7n8mEit8MMviCUMyID0b9F1HINI",
  authDomain: "my-dish-logger-app-gemin-7f51a.firebaseapp.com",
  projectId: "my-dish-logger-app-gemin-7f51a",
  storageBucket: "my-dish-logger-app-gemin-7f51a.firebasestorage.app",
  messagingSenderId: "626227241127",
  appId: "1:626227241127:web:916a24648dd8e9401d7b82",
  measurementId: "G-70SGL4JX1K"
};

// Initialize Firebase
const app = initializeApp(localFirebaseConfig);
const analytics = getAnalytics(app);


// Determine which Firebase config to use: Canvas-provided or local.
const firebaseConfig = typeof __firebase_config !== 'undefined' && Object.keys(JSON.parse(__firebase_config)).length > 0
  ? JSON.parse(__firebase_config)
  : localFirebaseConfig;

// Ensure __app_id and __initial_auth_token are available
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [dishes, setDishes] = useState([]);
  const [distinctDishes, setDistinctDishes] = useState([]); // New state for distinct dishes
  const [newDishName, setNewDishName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Default to today's date
  const [suggestedDish, setSuggestedDish] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // State for the edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [editedDishName, setEditedDishName] = useState(''); // Corrected initialization

  // State for the custom confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState(''); // Corrected initialization

  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    try {
      // Log Firebase config to help debug potential issues with the provided config
      console.log("Firebase App ID:", appId);
      console.log("Firebase Config (effective):", firebaseConfig);
      console.log("Initial Auth Token provided:", !!initialAuthToken); // Check if token exists

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
            } else {
              await signInAnonymously(firebaseAuth);
            }
          } catch (error) {
            console.error("Firebase authentication error:", error);
            setErrorMessage(`Failed to authenticate with Firebase: ${error.message}`);
          }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      setErrorMessage(`Failed to initialize Firebase. Please check your Firebase configuration and internet connection. Error: ${error.message}`);
      setLoading(false);
    }
  }, []);

  // Fetch dishes in real-time using onSnapshot
  useEffect(() => {
    if (db && userId && isAuthReady) {
      setLoading(true);
      setErrorMessage('');
      const dishesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/dishes`);
      const q = query(dishesCollectionRef);

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedDishes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
        }));
        fetchedDishes.sort((a, b) => b.date.getTime() - a.date.getTime()); // Sort newest first for display
        setDishes(fetchedDishes);

        // Update distinct dishes for the datalist
        const uniqueDishNames = [...new Set(fetchedDishes.map(dish => dish.dishName))];
        setDistinctDishes(uniqueDishNames);

        setLoading(false);
      }, (error) => {
        console.error("Error fetching dishes:", error);
        setErrorMessage(`Failed to load dishes. Please check your internet connection and Firebase Firestore setup. Error: ${error.message}`);
        setLoading(false);
      });

      return () => unsubscribe();
    } else if (isAuthReady && !userId) {
      setLoading(false);
    }
  }, [db, userId, isAuthReady]);

  const addDish = async () => {
    if (!newDishName.trim()) {
      setErrorMessage("Dish name cannot be empty.");
      return;
    }
    if (!selectedDate) {
      setErrorMessage("Please select a date for the dish.");
      return;
    }
    if (!db || !userId) {
      setErrorMessage("Firebase not initialized or user not authenticated.");
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const dishesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/dishes`);
      await addDoc(dishesCollectionRef, {
        dishName: newDishName,
        date: new Date(selectedDate), // Use the selected date
        createdAt: serverTimestamp(), // Keep a separate timestamp for creation
      });
      setNewDishName('');
      setSelectedDate(new Date().toISOString().split('T')[0]); // Reset date to today
    } catch (error) {
      console.error("Error adding dish:", error);
      setErrorMessage(`Failed to add dish. Please try again. Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const suggestDish = () => {
    if (dishes.length === 0) {
      setSuggestedDish("No dishes logged yet. Add some to get a suggestion!");
      return;
    }

    // Create a map to store the latest cooked date for each distinct dish
    const latestDishDates = {};
    dishes.forEach(dish => {
      if (!latestDishDates[dish.dishName] || dish.date.getTime() > latestDishDates[dish.dishName].getTime()) {
        latestDishDates[dish.dishName] = dish.date;
      }
    });

    // Convert the map to an array of objects
    let distinctDishesWithLatestDate = Object.keys(latestDishDates).map(dishName => ({
      dishName,
      latestDate: latestDishDates[dishName]
    }));

    // Get tomorrow's day of the week (0 for Sunday, 1 for Monday, ..., 6 for Saturday)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDay();

    let eligibleDishesForSuggestion = [];

    // Days to exclude Chicken/Egg: Monday (1), Tuesday (2), Thursday (4), Saturday (6)
    if (tomorrowDay === 1 || tomorrowDay === 2 || tomorrowDay === 4 || tomorrowDay === 6) {
      eligibleDishesForSuggestion = distinctDishesWithLatestDate.filter(dish =>
        !(dish.dishName.toLowerCase().includes('chicken') || dish.dishName.toLowerCase().includes('egg'))
      );
      if (eligibleDishesForSuggestion.length === 0) {
        setSuggestedDish("No non-Chicken/Egg dishes found for tomorrow's suggestion.");
        return;
      }
    } else {
      // Days to include all dishes: Sunday (0), Wednesday (3), Friday (5)
      eligibleDishesForSuggestion = distinctDishesWithLatestDate;
      if (eligibleDishesForSuggestion.length === 0) {
        setSuggestedDish("No dishes found for tomorrow's suggestion.");
        return;
      }
    }

    // Sort the eligible dishes by their latest cooked date in ascending order (oldest latest date first)
    eligibleDishesForSuggestion.sort((a, b) => a.latestDate.getTime() - b.latestDate.getTime());

    // Take the 5 oldest distinct eligible dishes
    const oldestFiveEligible = eligibleDishesForSuggestion.slice(0, 5);

    if (oldestFiveEligible.length === 0) {
      setSuggestedDish("Not enough dishes to suggest from your history for tomorrow.");
      return;
    }

    // Randomly pick one from the oldest five eligible dishes
    const randomIndex = Math.floor(Math.random() * oldestFiveEligible.length);
    setSuggestedDish(oldestFiveEligible[randomIndex].dishName);
  };

  const startEdit = (dish) => {
    setEditingDish(dish);
    setEditedDishName(dish.dishName);
    setIsEditModalOpen(true);
  };

  const saveEdit = async () => {
    if (!editingDish || !editedDishName.trim()) {
      setErrorMessage("Edited dish name cannot be empty.");
      return;
    }
    if (!db || !userId) {
      setErrorMessage("Firebase not initialized or user not authenticated.");
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const dishDocRef = doc(db, `artifacts/${appId}/users/${userId}/dishes`, editingDish.id);
      await updateDoc(dishDocRef, {
        dishName: editedDishName,
      });
      setIsEditModalOpen(false);
      setEditingDish(null);
      setEditedDishName('');
    } catch (error) {
      console.error("Error updating dish:", error);
      setErrorMessage(`Failed to update dish. Please try again. Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setIsEditModalOpen(false);
    setEditingDish(null);
    setEditedDishName('');
  };

  const handleDeleteClick = (dishId) => {
    setConfirmMessage("Are you sure you want to delete this dish?");
    setConfirmAction(() => async () => {
      if (!db || !userId) {
        setErrorMessage("Firebase not initialized or user not authenticated.");
        return;
      }
      setLoading(true);
      setErrorMessage('');
      try {
        const dishDocRef = doc(db, `artifacts/${appId}/users/${userId}/dishes`, dishId);
        await deleteDoc(dishDocRef);
      } catch (error) {
        console.error("Error deleting dish:", error);
        setErrorMessage(`Failed to delete dish. Please try again. Error: ${error.message}`);
      } finally {
        setLoading(false);
      }
      setIsConfirmModalOpen(false);
    });
    setIsConfirmModalOpen(true);
  };

  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction();
    }
  };

  const handleCancelConfirm = () => {
    setIsConfirmModalOpen(false);
    setConfirmAction(null);
  };

  // Helper to format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen relative p-4 sm:p-6 font-inter text-gray-800 flex flex-col items-center overflow-hidden">
      {/* Custom styles for the app */}
      <style>
        {`
          body { font-family: 'Inter', sans-serif; }
          .background-pattern::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: url('https://placehold.co/1200x800/FFF8E1/E65100?text=Food+Pattern'); /* Subtle food pattern placeholder */
            background-size: cover;
            background-position: center;
            opacity: 0.1; /* Make it very subtle */
            z-index: -1;
          }
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
          }
          .modal-content {
            background: white;
            padding: 2.5rem;
            border-radius: 1.5rem;
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
            width: 90%;
            max-width: 550px;
            animation: fadeInScale 0.3s ease-out forwards;
          }
          @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          .button-primary {
            @apply bg-gradient-to-br from-orange-500 to-orange-700 text-white font-extrabold py-4 px-8 rounded-2xl transition duration-300 ease-in-out shadow-xl transform hover:scale-105 active:scale-95 active:translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-orange-300 border-2 border-orange-800;
          }
          .button-secondary {
            @apply bg-gradient-to-br from-amber-200 to-amber-300 text-amber-800 font-bold py-3 px-6 rounded-xl transition duration-300 ease-in-out shadow-md hover:scale-105 active:scale-95 active:translate-y-0.5 border-2 border-amber-500; /* Increased border */
          }
          .button-danger {
            @apply bg-gradient-to-br from-red-500 to-red-600 text-white font-bold py-3 px-6 rounded-xl transition duration-300 ease-in-out shadow-md hover:scale-105 active:scale-95 active:translate-y-0.5 border-2 border-red-700; /* Increased border */
          }
          .input-field {
            @apply p-5 border-2 border-amber-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 w-full text-lg shadow-md bg-white bg-opacity-90 transition duration-200 ease-in-out; /* Increased padding */
          }
          .card {
            @apply bg-white rounded-2xl shadow-xl p-8 mb-6 border border-amber-100;
          }
        `}
      </style>

      <div className="background-pattern absolute inset-0 bg-gradient-to-br from-rose-50 to-amber-50"></div>

      <div className="max-w-3xl w-full relative z-10">
        <h1 className="text-5xl font-extrabold text-center text-amber-800 mb-10 mt-6 drop-shadow-md">
          My Daily Dish Log
        </h1>

        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-5 py-4 rounded-lg relative mb-6 text-center" role="alert">
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        {loading && (
          <div className="text-center text-orange-600 font-semibold text-lg mb-6">
            Loading...
          </div>
        )}

        {userId && (
          <div className="text-center text-sm text-gray-600 mb-8">
            Your User ID: <span className="font-mono bg-amber-100 px-3 py-1 rounded-md text-amber-800">{userId}</span>
          </div>
        )}

        {/* Add New Dish Section */}
        <div className="card">
          <h2 className="text-3xl font-semibold text-amber-700 mb-6">Log a New Dish</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="md:col-span-2">
              <input
                type="text"
                className="input-field"
                placeholder="What did you cook today?"
                value={newDishName}
                onChange={(e) => setNewDishName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    addDish();
                  }
                }}
                list="dish-suggestions" // Link to the datalist
              />
              <datalist id="dish-suggestions">
                {distinctDishes.map((dish, index) => (
                  <option key={index} value={dish} />
                ))}
              </datalist>
            </div>
            <div>
              <input
                type="date"
                className="input-field"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={addDish}
            className="button-primary w-full"
            disabled={loading}
          >
            Add Dish to Log
          </button>
        </div>

        {/* Suggest Dish Section */}
        <div className="card">
          <h2 className="text-3xl font-semibold text-amber-700 mb-6">Tomorrow's Meal Inspiration</h2>
          <button
            onClick={suggestDish}
            className="button-primary w-full mb-6"
            disabled={loading}
          >
            Suggest a Dish for Tomorrow
          </button>
          {suggestedDish && (
            <p className="text-2xl text-center font-bold text-orange-700 bg-orange-50 p-5 rounded-xl border border-orange-200 shadow-inner">
              ✨ {suggestedDish} ✨
            </p>
          )}
        </div>

        {/* Dish List Section */}
        <div className="card">
          <h2 className="text-3xl font-semibold text-amber-700 mb-6">Your Cooking History</h2>
          {dishes.length === 0 && !loading ? (
            <p className="text-gray-600 text-center text-lg py-4">No dishes logged yet. Start by adding one above!</p>
          ) : (
            <ul className="space-y-4">
              {dishes.map((dish) => (
                <li
                  key={dish.id}
                  className="flex flex-col sm:flex-row items-center justify-between bg-amber-50 p-5 rounded-xl shadow-sm border border-amber-200"
                >
                  <div className="flex-grow text-xl font-medium text-amber-800 mb-3 sm:mb-0">
                    {dish.dishName} <span className="text-base text-gray-500">({formatDate(dish.date)})</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => startEdit(dish)}
                      className="button-secondary text-sm px-4 py-2"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(dish.id)}
                      className="button-danger text-sm px-4 py-2"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit Dish Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="text-2xl font-bold text-amber-700 mb-5">Edit Dish</h3>
            <input
              type="text"
              className="input-field mb-6"
              value={editedDishName}
              onChange={(e) => setEditedDishName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  saveEdit();
                }
              }}
            />
            <div className="flex justify-end gap-4">
              <button
                onClick={cancelEdit}
                className="button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="button-primary"
                disabled={loading}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="text-2xl font-bold text-amber-700 mb-5">Confirm Action</h3>
            <p className="text-lg text-gray-700 mb-6">{confirmMessage}</p>
            <div className="flex justify-end gap-4">
              <button
                onClick={handleCancelConfirm}
                className="button-secondary"
              >
                No, Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="button-danger"
                disabled={loading}
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
