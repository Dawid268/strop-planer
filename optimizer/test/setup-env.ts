import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const testDbDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true });
}

const testDbPath = path.resolve(testDbDir, `test-${Date.now()}.db`);
process.env.DATABASE_PATH = testDbPath;

process.on('exit', () => {
  try {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  } catch {
    // ignore cleanup errors
  }
});
