import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';

// Initialize Firebase Admin
admin.initializeApp();

const app = express();

// Enable CORS for all origins (you may want to restrict this in production)
app.use(cors({ origin: true }));
app.use(express.json());

// Firestore reference
const db = admin.firestore();

// Projects endpoints
app.get('/projects', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // In a real implementation, you'd verify the Firebase ID token here
    // const idToken = authHeader.split('Bearer ')[1];
    // const decodedToken = await admin.auth().verifyIdToken(idToken);
    // const userId = decodedToken.uid;

    // For now, we'll create some sample projects
    const projectsSnapshot = await db.collection('projects').get();
    const projects = projectsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/projects', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = {
      name,
      description: description || '',
      owner_id: 'temp-user-id', // Replace with actual user ID from token
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      collaborators: ['temp-user-id'],
      userRole: 'owner'
    };

    const projectRef = await db.collection('projects').add(project);
    const newProject = { id: projectRef.id, ...project };

    res.json({ project: newProject });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Files endpoints
app.get('/projects/:projectId/files', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId } = req.params;
    
    const filesSnapshot = await db
      .collection('projects')
      .doc(projectId)
      .collection('files')
      .get();
    
    const files = filesSnapshot.docs.map((doc: any) => ({
      path: doc.id,
      ...doc.data()
    }));

    res.json({ files });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/projects/:projectId/files', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId } = req.params;
    const { path, content, type } = req.body;

    const file = {
      content: content || '',
      type: type || 'file',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'temp-user-id',
      version: 1
    };

    await db
      .collection('projects')
      .doc(projectId)
      .collection('files')
      .doc(path)
      .set(file);

    res.json({ file: { path, ...file } });
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Messages endpoints (for chat)
app.get('/projects/:projectId/messages', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId } = req.params;
    
    const messagesSnapshot = await db
      .collection('projects')
      .doc(projectId)
      .collection('messages')
      .orderBy('created_at', 'desc')
      .limit(50)
      .get();
    
    const messages = messagesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/projects/:projectId/messages', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId } = req.params;
    const { content, type } = req.body;

    const message = {
      content,
      type: type || 'text',
      user_id: 'temp-user-id',
      user_name: 'Test User',
      created_at: new Date().toISOString(),
      project_id: projectId
    };

    const messageRef = await db
      .collection('projects')
      .doc(projectId)
      .collection('messages')
      .add(message);

    res.json({ message: { id: messageRef.id, ...message } });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Presence endpoints
app.get('/projects/:projectId/presence', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId } = req.params;
    
    const presenceSnapshot = await db
      .collection('projects')
      .doc(projectId)
      .collection('presence')
      .get();
    
    const presence = presenceSnapshot.docs.map((doc: any) => ({
      user_id: doc.id,
      ...doc.data()
    }));

    res.json({ presence });
  } catch (error) {
    console.error('Error fetching presence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/projects/:projectId/presence', async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { projectId } = req.params;
    const { file, cursor } = req.body;

    const presenceData = {
      user_name: 'Test User',
      user_avatar: '',
      file: file || null,
      cursor: cursor || null,
      last_seen: new Date().toISOString()
    };

    await db
      .collection('projects')
      .doc(projectId)
      .collection('presence')
      .doc('temp-user-id')
      .set(presenceData);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating presence:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export the Express app as a Firebase Function
export const api = functions.https.onRequest(app);

// Export email service
export { sendInvitations } from './email-service';
