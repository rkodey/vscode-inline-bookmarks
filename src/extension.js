'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */
/** imports */
const vscode = require('vscode');
const settings = require('./settings');
const {InlineBookmarksCtrl, InlineBookmarkTreeDataProvider} = require('./features/inlineBookmarks');


function editorJumptoRange(range) {

    let revealType = vscode.TextEditorRevealType.InCenter;
    let selection = new vscode.Selection(range.start.line, range.start.character, range.end.line, range.end.character);

    if (range.start.line === vscode.window.activeTextEditor.selection.active.line) {
        revealType = vscode.TextEditorRevealType.InCenterIfOutsideViewport;
    }

    vscode.window.activeTextEditor.selection = selection;
    vscode.window.activeTextEditor.revealRange(selection, revealType);
}

function onActivate(context) {
    const auditTags = new InlineBookmarksCtrl(context);
    const treeDataProvider = new InlineBookmarkTreeDataProvider(auditTags);

    var activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor || !activeEditor.document) return;

    /** register views */
    const treeView = vscode.window.createTreeView('inlineBookmarksExplorer', { treeDataProvider });

    /*
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider("inlineBookmarksExplorer", treeDataProvider)
    );
    */
    
    /** register commands */
    context.subscriptions.push(
        vscode.commands.registerCommand("inlineBookmarks.jumpToRange", (documentUri, range) => {
            vscode.workspace.openTextDocument(documentUri).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                    editorJumptoRange(range);
                });
            });
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("inlineBookmarks.refresh", () => {
            auditTags.commands.refresh();
            treeDataProvider.refresh();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("inlineBookmarks.toggleShowVisibleFilesOnly", () => {
            settings.extensionConfig().update("view.showVisibleFilesOnly", !settings.extensionConfig().view.showVisibleFilesOnly);
            auditTags.commands.refresh();
            treeDataProvider.refresh();
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("inlineBookmarks.toggleViewKeepFilesExpanded", () => {
            settings.extensionConfig().update("view.expanded", !settings.extensionConfig().view.expanded);
        })
    );
    /** module init */
    auditTags.commands.refresh();
    treeDataProvider.refresh();
    onDidChange();

    /** event setup */
    /***** OnChange */
    vscode.window.onDidChangeActiveTextEditor(editor => {
        activeEditor = editor;
        if (editor) {
            onDidChange(editor);
        }
    }, null, context.subscriptions);
    /***** OnChange */
    vscode.workspace.onDidChangeTextDocument(event => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            onDidChange(vscode.window.activeTextEditor, event);
        }
    }, null, context.subscriptions);
    /***** OnSave */

    vscode.workspace.onDidSaveTextDocument(document => {
        onDidSave(vscode.window.activeTextEditor);  
    }, null, context.subscriptions);
    
    /****** OnOpen */
    vscode.workspace.onDidOpenTextDocument(document => {
        onDidSave(vscode.window.activeTextEditor);  
    }, null, context.subscriptions);

    /****** OnClose */
    vscode.workspace.onDidCloseTextDocument(document => {
        onDidSave();  
    }, null, context.subscriptions);

     /****** OnScroll / OnDidChangeTextEditorVisibleRanges */
    
    vscode.window.onDidChangeTextEditorSelection(event /* TextEditorVisibleRangesChangeEvent */ => {
        onDidSelectionChange(event);
    }, null, context.subscriptions);

    /************* handler */
    async function onDidChange(editor, event) {
        return new Promise((resolve,reject) => {
            if(settings.extensionConfig().enable){
                auditTags.decorate(editor);
            }
            treeDataProvider.refresh();
            resolve();
        });
    }
    async function onDidSave(editor) {
        return new Promise((resolve,reject) => {
            if(editor && settings.extensionConfig().enable){
                auditTags.decorate(editor);
            }
            treeDataProvider.refresh();
            resolve();
        });
    }
    async function onDidSelectionChange(event){
        if(!treeView.visible || !settings.extensionConfig().view.follow){
            return;  // not visible, no action
        }

        let documentUri = event.textEditor._documentData._uri;

        if(event.textEditor._visibleRanges.length <= 0 || event.selections.length <= 0){
            return;  // no visible range open; no selection
        }

        let root = treeDataProvider.getChildren().find(f => f.name == documentUri.toString());
        if (!root){
            return;  // file not found
        }

        //select bookmark that is closest to selection (or center of screen)
        let focusLine = event.selections[0].anchor.line;

        let focusBookmark = treeDataProvider
            .getChildren(root)
            .reduce( (prevs, current) => Math.abs(focusLine - current.location.range.start.line) <= Math.abs(focusLine - prevs.location.range.start.line) ? current : prevs);

        treeView.reveal(focusBookmark, {selected:true, focus:true});
    }
}

/* exports */
exports.activate = onActivate;