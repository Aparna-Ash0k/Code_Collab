import JSZip from 'jszip';
import { ProjectFile } from '../hooks/useProject';

/**
 * Exports project files as a downloadable ZIP archive
 * @param projectName - Name of the project (used for ZIP filename)
 * @param files - Array of project files to include in the export
 */
export async function exportProjectAsZip(projectName: string, files: ProjectFile[]): Promise<void> {
  try {
    const zip = new JSZip();

    // Filter out folder entries (we only need files, folders are implicit in paths)
    const actualFiles = files.filter(file => file.type === 'file');

    // Add each file to the ZIP
    for (const file of actualFiles) {
      zip.file(file.path, file.content);
    }

    // Generate the ZIP file
    const blob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6 // Moderate compression level (0-9)
      }
    });

    // Create a download link and trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(projectName)}.zip`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export project as ZIP:', error);
    throw new Error('Failed to export project. Please try again.');
  }
}

/**
 * Sanitizes a filename by removing or replacing invalid characters
 * @param filename - The filename to sanitize
 * @returns A safe filename for download
 */
function sanitizeFileName(filename: string): string {
  // Replace invalid characters with underscores
  return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim() || 'project';
}
