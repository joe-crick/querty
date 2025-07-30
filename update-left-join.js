import fs from 'fs';

// Read the file
const filePath = './tests/test-data/select/select-left-join.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Update each entry to have id match userId
const updatedData = data.map(entry => ({
  ...entry,
  id: entry.userId
}));

// Write the updated data back to the file
fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf8');

console.log('File updated successfully.');