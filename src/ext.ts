import * as flashpoint from 'flashpoint-launcher';
import * as fs from 'fs-extra';
import * as klaw from 'klaw';
import * as path from 'path';

export async function activate(context: flashpoint.ExtensionContext) {
  const checkGame = async (gameData: flashpoint.GameData) => {
    flashpoint.log.info("Calling checkGame");
    flashpoint.log.info("gameData.parameters: " + gameData.parameters);
    if (gameData.parameters === '-extract') {
      flashpoint.log.debug("Extracting");
      const prefs = flashpoint.getPreferences();
      const tempDir = path.join(flashpoint.extensionPath, '.temp');
      await fs.promises.mkdir(tempDir, { recursive: true });
      const extractedFileName = path.join(flashpoint.extensionPath, 'extracted.json');
      const extractedContents = await fs.promises.readFile(extractedFileName, 'utf-8').catch(() => '[]');
      flashpoint.log.debug("extractedContents: " + extractedContents);
      const extracted = extractedContents ? JSON.parse(extractedContents) as [string] : [];
      if (!extracted.includes(gameData.gameId)) {
        flashpoint.log.debug("gameId not in extracted");
        const gamePath = path.join(flashpoint.config.flashpointPath, prefs.dataPacksFolderPath, gameData.path);
        const htdocsPath = path.join(flashpoint.config.flashpointPath, prefs.htdocsFolderPath);
        flashpoint.log.debug("gamePath: " + gamePath);
        flashpoint.log.debug("htdocsPath: " + htdocsPath);
        try {
          await flashpoint.unzipFile(gamePath, tempDir, {});
          //const gameFiles = await fs.promises.readdir(path.join(tempDir, 'content'));
          const movePromises = [];
          for await (let gameFileItem of klaw(path.join(tempDir, 'content'))) {
            if (gameFileItem.stats.isFile()) {
              const gameFileSource = gameFileItem.path;
              const gameFileRelative = path.relative(path.join(tempDir, 'content'), gameFileSource);
              const gameFileDest = path.join(htdocsPath, gameFileRelative);
              flashpoint.log.debug("Gamefile source: " + gameFileSource + " Gamefile relative: " + gameFileRelative + " Gamefile dest: "+ gameFileDest);
              movePromises.push(fs.move(gameFileSource, gameFileDest, {overwrite: true}));   
            }
          }
          await Promise.all(movePromises);
          await fs.promises.rmdir(tempDir, { recursive: true });
          flashpoint.log.info("Game unzipped");
          extracted.push(gameData.gameId);
          flashpoint.log.debug("New extracted JSON: " + JSON.stringify(extracted));
          await fs.promises.writeFile(extractedFileName, JSON.stringify(extracted), 'utf-8');
        } catch (e) {
          flashpoint.log.error("Unable to unzip game!");
          flashpoint.log.error(e);
        }
      }
    }
  }
  
  flashpoint.registerDisposable(context.subscriptions, flashpoint.games.onDidInstallGameData(checkGame));
  flashpoint.registerDisposable(context.subscriptions, flashpoint.games.onWillLaunchGame((gameLaunch) => {
    if (gameLaunch.activeData) {
      checkGame(gameLaunch.activeData);
    }
  }));

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
