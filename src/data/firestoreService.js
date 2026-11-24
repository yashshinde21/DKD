
import {
  getFirestore,
  collection,
  getDocs,
} from '@react-native-firebase/firestore';

const db = getFirestore();

export const fetchFruits = async () => {
  try {
    const fruitsCollection = collection(db, 'fruits');
    const snapshot = await getDocs(fruitsCollection);

    const fruitList = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data(),
    }));

    console.log('Fruits fetched successfully:', fruitList);

    return fruitList;
  } catch (error) {
    console.error('Error fetching fruits from Firestore:', error);
    throw error;
  }
};
