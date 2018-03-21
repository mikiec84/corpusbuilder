import React from 'react';

import { observable, computed } from 'mobx';
import { Provider, observer } from 'mobx-react'
import { PageFlow } from '../PageFlow';
import { PageFlowItem } from '../PageFlowItem';
import { Button } from '../Button';
import { ProgressIndicator } from '../ProgressIndicator';

import State from '../../stores/State'
import FetchSimilarDocuments from '../../actions/FetchSimilarDocuments';
import UploadDocumentImages from '../../actions/UploadDocumentImages';
import Dropzone from 'react-dropzone'
import Request from '../../lib/Request';
import styles from './Uploader.scss';

@observer
export default class Uploader extends React.Component {

    constructor(props) {
        super(props);

        this.appState = new State(this.props.baseUrl);
        Request.setBaseUrl(props.baseUrl);
    }

    progressEvents = [
        {
            name: 'FetchSimilarDocuments',
            title: <div>
              Searching for documents for given metadata...
            </div>
        }
    ];

    @observable
    isUploading = false;

    @observable
    files = [ ];

    @observable
    metadata = null;

    @observable
    uploadNewChosen = false;

    @observable
    pickedDocument = null;

    @computed
    get similarDocuments() {
        if(this.isMetadataReady) {
            return FetchSimilarDocuments.run(
                this.appState,
                {
                  select: {
                  },
                  metadata: this.metadata
                }
            )
        }

        return null;
    }

    @computed
    get isMetadataReady() {
        return this.metadata !== undefined &&
            this.metadata !== null &&
            this.metadata.title !== undefined &&
            this.metadata.title !== null &&
            this.metadata.title !== "";
    }

    @computed
    get currentLevel() {
        if(!this.isMetadataReady) {
            return 'pre-metadata';
        }
        else if(!this.uploadNewChosen) {
            return 'similar-documents';
        }
        else {
            return 'images-upload';
        }
    }

    @computed
    get sharedContext() {
        return {
            appState: this.appState,
            editorEmail: this.props.editorEmail
        };
    }

    componentWillUpdate(props) {
        this.metadata = props.metadata;
    }

    fileSizeLabel(file) {
        if(file.size >= 10e5) {
            return `${Math.round(file.size / 10e5)}MB`
        }
        else {
            return `${Math.round(file.size / 10e2)}KB`
        }
    }

    fileProgress(file) {
        if(file.progress !== null) {
            return `${Math.round(file.progress * 100)}%`;
        }
    }

    onDocumentPicked(doc) {
        if(doc === this.pickedDocument) {
            this.pickedDocument = null;

            if(typeof this.props.onDocumentUnpicked === 'function') {
                this.props.onDocumentUnpicked();
            }
        }
        else {
            if(this.props.onDocumentPicked !== undefined && this.props.onDocumentPicked !== null) {
                this.props.onDocumentPicked(doc);
            }

            this.pickedDocument = doc;
        }
    }

    onUploadNewChosen() {
        if(this.pickedDocument === null) {
            this.props.onDocumentUnpicked();
            this.pickedDocument = null;
        }

        this.uploadNewChosen = true;
    }

    onDrop(accepted, rejected) {
        for(let file of accepted) {
            this.files.push(observable({
                file: file,
                progress: null,
                status: 'initial'
            }));
        }
    }

    onBackToSimilarDocuments() {
        this.uploadNewChosen = false;
    }

    onFileUnpickClicked(file) {
        this.files = this.files.filter((f) => {
            return f.file !== file;
        });
    }

    onUploadClicked() {
        this.isUploading = true;

        UploadDocumentImages.run(
            this.appState,
            {
                select: {},
                files: this.files
            }
        );
    }

    renderPreMeta() {
        return (
            <div className="corpusbuilder-uploader-explain">
                You must provide document metadata first. At least the document
                title is required to send the scans to be OCR'ed.
            </div>
        );
    }

    renderSimilarDocuments() {
        let items = null;
        if(this.similarDocuments === undefined || this.similarDocuments === null) {
            items = <i>Fetching similar documents, please wait...</i>;
        }
        else if(this.similarDocuments.length > 0) {
            let docItems =
                this.similarDocuments.map((doc) => {
                    let classes = [ "corpusbuilder-uploader-similar-documents-item" ];

                    if(doc == this.pickedDocument) {
                        classes.push('picked');
                    }

                    return [
                        <div key="list" className={ classes.join(' ') }>
                            <div className="corpusbuilder-uploader-similar-documents-item-top-label">
                                Existing document:
                            </div>
                            <div className="corpusbuilder-uploader-similar-documents-item-body">
                                <div className="corpusbuilder-uploader-similar-documents-item-row">
                                    <div className="corpusbuilder-uploader-similar-documents-item-label">
                                        Title:
                                    </div>
                                    <div className="corpusbuilder-uploader-similar-documents-item-value">
                                        { doc.title }
                                    </div>
                                </div>
                                <div className="corpusbuilder-uploader-similar-documents-item-row">
                                    <div className="corpusbuilder-uploader-similar-documents-item-label">
                                        Date:
                                    </div>
                                    <div className="corpusbuilder-uploader-similar-documents-item-value">
                                        { doc.date }
                                    </div>
                                </div>
                                <div className="corpusbuilder-uploader-similar-documents-item-row">
                                    <div className="corpusbuilder-uploader-similar-documents-item-label">
                                        Author:
                                    </div>
                                    <div className="corpusbuilder-uploader-similar-documents-item-value">
                                        { doc.author }
                                    </div>
                                </div>
                            </div>
                            <div className="corpusbuilder-uploader-similar-documents-item-preview">
                              <img src={ doc.images_sample[0].url } />
                            </div>
                            <Button onClick={ this.onDocumentPicked.bind(this, doc) }>
                                { doc === this.pickedDocument ? 'Unpick' : 'Pick' }
                            </Button>
                        </div>
                    ];
                });
            docItems.push(
                <div key="new-one" className="corpusbuilder-uploader-similar-documents-item clickable"
                     onClick={ this.onUploadNewChosen.bind(this) }>
                    <div className="corpusbuilder-uploader-similar-documents-item-top-label-big">
                        +
                    </div>
                    <div className="corpusbuilder-uploader-similar-documents-item-top-label">
                        Add New
                    </div>
                </div>
            );
            items = [
                <div key="explain" className="corpusbuilder-uploader-explain">
                    If any of the following documents represent the one described
                    in the metadata: please click on the "Pick" button.
                    Otherwise, please click on next to continue.
                </div>,
                <div className="corpusbuilder-uploader-similar-documents-list">
                    { docItems }
                </div>
            ];
        }
        else {
            items = <i>No similar document has been found for given metadata. Please click next to continue</i>;
        }

        return (
            <div className="corpusbuilder-uploader-similar-documents">
                { items }
            </div>
        );
    }

    renderImagesUpload() {
        let files = <i>No files chosen yet...</i>;

        if(this.files.length > 0) {
            files = (
                <div className="corpusbuilder-uploader-images-upload-files">
                    {
                        this.files.map((file) => {
                            return (
                                <div className="corpusbuilder-uploader-images-upload-files-item">
                                    <div className="corpusbuilder-uploader-images-upload-files-item-name">
                                        { file.file.name }
                                    </div>
                                    <div className="corpusbuilder-uploader-images-upload-files-item-size">
                                        { this.fileSizeLabel(file.file) }
                                    </div>
                                    <div className="corpusbuilder-uploader-images-upload-files-item-progress">
                                        { this.fileProgress(file) }
                                    </div>
                                    <div className="corpusbuilder-uploader-images-upload-files-item-buttons">
                                        <Button onClick={ this.onFileUnpickClicked.bind(this, file.file) }
                                                disabled={ this.isUploading }>
                                            Unpick
                                        </Button>
                                    </div>
                                </div>
                            )
                        })
                    }
                </div>
            );
        }

        return (
            <div className="corpusbuilder-uploader-images-upload">
                <Dropzone onDrop={this.onDrop.bind(this)} disabled={ this.isUploading }>
                    Drop Files Here
                </Dropzone>
                { files }
                <div className="corpusbuilder-uploader-images-upload-buttons">
                    <Button onClick={ this.onBackToSimilarDocuments.bind(this) } disabled={ this.isUploading }>
                        Back
                    </Button>
                    <Button onClick={ this.onUploadClicked.bind(this) }
                            disabled={ this.files.length === 0 || this.isUploading }>
                        Upload!
                    </Button>
                </div>
            </div>
        );
    }

    renderImagesReady() {
        return <i>TODO: show the info that the images are ready</i>;
    }

    render() {
        console.log("Uploader render with metadata:", this.props.metadata);

        return (
            <Provider {...this.sharedContext}>
                <div className="corpusbuilder-uploader">
                    <ProgressIndicator events={ this.progressEvents }>
                    </ProgressIndicator>
                    <div className="corpusbuilder-uploader-title">Scans of documents to OCR</div>
                    <PageFlow>
                        <PageFlowItem isActive={ this.currentLevel === 'pre-metadata' }>
                            { this.renderPreMeta() }
                        </PageFlowItem>
                        <PageFlowItem isActive={ this.currentLevel === 'similar-documents' }>
                            { this.renderSimilarDocuments() }
                        </PageFlowItem>
                        <PageFlowItem isActive={ this.currentLevel === 'images-upload' }>
                            { this.renderImagesUpload() }
                        </PageFlowItem>
                        <PageFlowItem isActive={ this.currentLevel === 'images-ready' }>
                            { this.renderImagesReady() }
                        </PageFlowItem>
                    </PageFlow>
                </div>
            </Provider>
        );
    }
}