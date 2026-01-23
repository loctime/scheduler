import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EmployeeRequestData } from '@/components/employee-request-dialog';

export interface EmployeeRequest extends EmployeeRequestData {
  scheduleId: string;
  employeeId: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

const COLLECTION_NAME = 'apps/horarios/employeeRequests';

/**
 * Guardar o actualizar un pedido de empleado
 */
export const saveEmployeeRequest = async (
  scheduleId: string,
  employeeId: string,
  date: string,
  requestData: EmployeeRequestData
): Promise<void> => {
  if (!db) {
    throw new Error('Firestore no está inicializado');
  }

  try {
    const docId = `${scheduleId}_${employeeId}_${date}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    
    const employeeRequest: EmployeeRequest = {
      ...requestData,
      scheduleId,
      employeeId,
      date,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(docRef, employeeRequest);
  } catch (error) {
    console.error('Error saving employee request:', error);
    throw error;
  }
};

/**
 * Obtener un pedido de empleado específico
 */
export const getEmployeeRequest = async (
  scheduleId: string,
  employeeId: string,
  date: string
): Promise<EmployeeRequest | null> => {
  if (!db) {
    return null;
  }

  try {
    const docId = `${scheduleId}_${employeeId}_${date}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as EmployeeRequest;
    }
    return null;
  } catch (error) {
    console.error('Error getting employee request:', error);
    return null;
  }
};

/**
 * Eliminar un pedido de empleado
 */
export const deleteEmployeeRequest = async (
  scheduleId: string,
  employeeId: string,
  date: string
): Promise<void> => {
  if (!db) {
    throw new Error('Firestore no está inicializado');
  }

  try {
    const docId = `${scheduleId}_${employeeId}_${date}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting employee request:', error);
    throw error;
  }
};
