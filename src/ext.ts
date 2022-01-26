import * as flashpoint from 'flashpoint-launcher';
import * as fs from 'fs-extra';
import * as path from 'path';

export async function activate(context: flashpoint.ExtensionContext) {
  const checkGame = async (gameData: flashpoint.GameData) => {
    if (gameData.parameters === '-extract') {
      const prefs = flashpoint.getPreferences();
      const tempDir = path.join(flashpoint.extensionPath, '.temp');
      await fs.promises.mkdir(tempDir, { recursive: true });
      const gamePath = path.join(flashpoint.config.flashpointPath, prefs.dataPacksFolderPath, gameData.path);
      const htdocsPath = path.join(flashpoint.config.flashpointPath, prefs.htdocsFolderPath);
      await flashpoint.unzipFile(gamePath, tempDir, {});
      await fs.copy(path.join(tempDir, 'content'), htdocsPath);
    }
  }
  
  flashpoint.registerDisposable(context.subscriptions, flashpoint.games.onDidInstallGameData(checkGame));

  flashpoint.registerDisposable(context.subscriptions, flashpoint.commands.registerCommand('automount-extractor.extract-all', async () => {
    flashpoint.status.setStatus('devConsole', 'Extracting all relevant games...');
    const pages = await flashpoint.games.findGames({}, false);
    for (const page of pages) {
      for (const game of page.games) {
        if (game.activeDataId && game.activeDataOnDisk) {
          const gameData = await flashpoint.gameData.findOne(game.activeDataId);
          await checkGame(gameData);
        }
      }
    }
    flashpoint.status.setStatus('devConsole', 'Finished!');
  }));
}