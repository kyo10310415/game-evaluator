import { createApp } from './app.js';
import dotenv from 'dotenv';
import { testConnection } from './utils/database.js';
import { EvaluationModel } from './models/evaluation-model.js';

dotenv.config();
const app = createApp({ EvaluationModel });
testConnection();
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on port ${PORT}`));
export default app;
