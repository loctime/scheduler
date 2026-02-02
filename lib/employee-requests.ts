import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { EmployeeRequestData } from '@/components/employee-request-dialog';

export interface EmployeeRequest extends EmployeeRequestData {
  userId: string;
  scheduleId: string;
  employeeId: string;
  date: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

const COLLECTION_NAME = 'apps/horarios/employee_requests';

/**
 * Guardar o actualizar un pedido de empleado
 */
export const saveEmployeeRequest = async (
  scheduleId: string,
  employeeId: string,
  date: string,
  requestData: EmployeeRequestData,
  ownerId: string
): Promise<void> => {
  if (!db) {
    throw new Error('Firestore no está inicializado');
  }

  try {
    // VALIDACIÓN Y LOGS DE DEPURACIÓN
    console.log('EMPLOYEE REQUEST – PAYLOAD DEBUG');
    console.log('auth.currentUser?.uid:', auth?.currentUser?.uid);
    console.log('ownerId enviado:', ownerId);
    console.log('userId enviado:', auth?.currentUser?.uid);
    console.log('employeeId (si existe):', employeeId);
    
    // Verificar explícitamente que ownerId exista y sea válido
    if (!ownerId || ownerId === 'undefined' || ownerId === 'null' || ownerId === '') {
      console.error('EMPLOYEE REQUEST – ownerId MISSING OR INVALID');
      throw new Error('ownerId es requerido y no puede estar vacío');
    }

    // Verificar que el usuario esté autenticado
    if (!auth?.currentUser?.uid) {
      console.error('EMPLOYEE REQUEST – USER NOT AUTHENTICATED');
      throw new Error('Usuario no autenticado');
    }

    const docId = `${scheduleId}_${employeeId}_${date}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    
    const employeeRequest: EmployeeRequest = {
      ...requestData,
      userId: auth.currentUser.uid, // UID del usuario autenticado
      scheduleId,
      employeeId, // ID real del empleado solicitado
      date,
      ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('EMPLOYEE REQUEST – DOCUMENTO COMPLETO:', employeeRequest);

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
