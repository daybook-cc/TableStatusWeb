import { h, Component, createRef } from 'preact';
import moment from 'moment';

import UserStorage from '../../lib/UserStorage';
import CollapseWidget from '../collapse_widget';
import style from './style';


const ROTATION_INTERVAL_MS = process.env.PREACT_APP_PHOTOS_ROTATION_INTERVAL_MS;

const PHOTO_WIDTH = 1200;
const PHOTO_HEIGHT = 800;

const ALBUMS_LIMIT = 15;
const PHOTOS_LIMIT = 100;

const STORE_ALBUM_KEY = 'ALBUM';
const STORE_ALBUM_PHOTOS = 'PHOTOS';
const STORE_ALBUM_SINGLE_PHOTO = 'PHOTO';


export default class PhotosWidget extends Component {
  constructor(props) {
    super(props);
    this.state = {
      albums: [],
      selectedAlbum: {},
      selectedAlbumPhotos: [],
      randomPic: {
        mediaMetadata: {}
      },
      randomPicIndex: null,
      collapsed: false
    }

    this.storage = new UserStorage({
      prefix: 'STENGAZETA_PHOTOS'
    });
    this.isIOS = function() {
      // iOS does not play Google Photos mp4
      if (typeof window !== 'undefined') {
        // ugly build hack
        return !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      } else {
        return false;
      }
    }();

    this.onAlbumSelected = this.onAlbumSelected.bind(this);
    this.getPicByIndex = this.getPicByIndex.bind(this);
    this.timer = null;
  }

  listAlbums() {
    if (!this.props.signedIn) {
      return;
    }

    this.listMyAlbums();
    this.listSharedAlbums();
  }

  listMyAlbums() {
    gapi.client.photoslibrary.albums.list({
      'pageSize': ALBUMS_LIMIT
    }).then((response) => {
      let albums = response.result.albums;
      console.log('Photos Albums', albums);
      this.setState((state) => ({
        albums: state.albums.concat(albums)
      }));

    });
  }

  listSharedAlbums() {
    gapi.client.photoslibrary.sharedAlbums.list({
      'pageSize': ALBUMS_LIMIT
    }).then((response) => {
      let albums = response.result.sharedAlbums;
      console.log('Shared Photos Albums', albums);
      this.setState((state) => ({
        albums: state.albums.concat(albums)
      }));
    });
  }

  listPhotosOfAlbum() {
    if (!this.props.signedIn) {
      return;
    }
    gapi.client.photoslibrary.mediaItems.search({
      'albumId': this.state.selectedAlbum.id,
      'pageSize': PHOTOS_LIMIT
    }).then((response) => {
      let photos = response.result.mediaItems;
      console.log('Photos', photos);
      this.setState({selectedAlbumPhotos: photos});
      this.startRandomRotator(photos);

      this.storage.setItem(STORE_ALBUM_PHOTOS, JSON.stringify(photos));
    });
  }

  startRandomRotator(photos) {
    console.log('Photos startRandomRotator');
    clearInterval(this.timer);

    this.selectRandomPic(photos);
    this.timer = setInterval(this.selectRandomPic.bind(this, photos), ROTATION_INTERVAL_MS);
  }

  selectRandomPicFromState() {
    return this.selectRandomPic(this.state.selectedAlbumPhotos);
  }

  selectRandomPic(photos) {
    if (!photos.length) {
      return;
    }

    let itemIndex = Math.floor(Math.random() * photos.length);
    let photo = photos[itemIndex];
    if (!photo) {
      console.error('Photos index non-existent', itemIndex, photos);
      return this.selectRandomPic(photos);
    }

    this.fetchPicture(photo.id);
  }

  fetchPicture(id) {
    if (!this.props.signedIn) {
      return;
    }
    gapi.client.photoslibrary.mediaItems.get({
      'mediaItemId': id
    }).then((response) => {
      let photo = response.result;
      // console.log('Photos fetchPicture', response.result);

      this.setState({ randomPic: photo });
      this.storage.setItem(STORE_ALBUM_SINGLE_PHOTO, JSON.stringify(photo));
    });

  }

  getPicByIndex() {
    return this.state.selectedAlbumPhotos[this.state.randomPicIndex];
  }

  // gets called when this route is navigated to
  componentDidMount() {
    this.getFromStorage();
    if (this.props.signedIn) {
      this.listAlbums();
    }
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.signedIn && this.props.signedIn) {
      this.listAlbums();
      if (this.state.selectedAlbum.id) {
        this.startRandomRotator(this.state.selectedAlbumPhotos);
      }
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  onAlbumSelected(album) {
    console.log('onAlbumSelected', album);
    this.setState({selectedAlbum: album});

    this.storage.setItem(STORE_ALBUM_KEY, JSON.stringify(album));
    setTimeout(this.listPhotosOfAlbum.bind(this), 0);
  }

  selectOther() {
    this.setState({selectedAlbum: {}});
    this.storage.setItem(STORE_ALBUM_KEY, null);
    clearInterval(this.timer);
  }

  getFromStorage() {
    const album = this.storage.getItem(STORE_ALBUM_KEY);
    const photos = this.storage.getItem(STORE_ALBUM_PHOTOS);
    let albumObj = {};
    let photosObj = [];

    try {
      albumObj = JSON.parse(album);
      photosObj = JSON.parse(photos);
    } catch(err) {
      console.error('Photos, restoring from storage failed', err);
      return false;
    }

    console.log('Photos, restored', albumObj, photosObj);
    if (albumObj === null || photosObj === null) {
      return false;
    }
    this.setState({
      selectedAlbum: albumObj,
      selectedAlbumPhotos: photosObj
    });
    this.startRandomRotator(photosObj);

    return true;
  }

  render() {
    return (
      <div class={this.state.selectedAlbum.id ? 'selected' : ''}>
        <h1 class={this.state.collapsed ? style.collapse_after : null}>
          {this.state.selectedAlbum.title ? this.state.selectedAlbum.title : 'Фото'}
           <CollapseWidget onClick={(collapsed) => this.setState({collapsed})} />
        </h1>
        <div class={this.state.selectedAlbum.id ? style.hide : ''}>
          <p>Выберите альбомы для слайдшоу:</p>
          {
            this.state.albums.map((album) => <PhotosWidgetAlbum onClick={() => this.onAlbumSelected(album)} album={album} /> )
          }
        </div>

        <div class={!this.state.selectedAlbum.id ? style.hide : ''}>
          <PhotosWidgetPhotos photo={this.state.randomPic} isIOS={this.isIOS}></PhotosWidgetPhotos>
        </div>
        <div class={!this.state.selectedAlbum.id ? style.hide : style.selectOther}>
          <span onClick={() => this.selectOther()}>Выбрать другой альбом</span>
          <span onClick={() => this.selectRandomPicFromState()}>Следующая фотография</span>
        </div>
      </div>
    );
  }
}

export class PhotosWidgetAlbum extends Component {
  render({album, onClick}) {
    return (
      <div onClick={onClick} class={style.album}>
        <span>{ album.title }</span>
      </div>
    );
  }
}

export class PhotosWidgetPhotos extends Component {
  prepareData(photo) {
    console.log('prepareData', photo);
    let suffix = `=h${PHOTO_HEIGHT}`;
    let result = {
      imgUrl: photo.baseUrl + suffix,
      productUrl: photo.productUrl,
      videoUrl: null
    }
    if (photo.mediaMetadata && photo.mediaMetadata.video) {
      result.videoUrl = photo.baseUrl + '=dv';
    }
    console.log('prepareData result', result);
    return result;
  }

  render({photo, isIOS}) {
    const newImg = this.prepareData(photo);
    console.log('PhotosWidgetPhotos render', newImg.imgUrl, newImg);

    return (
      <div class={style.container}>
        <div class={style.photo_wrapper}>
          { isIOS && newImg.videoUrl && (<PhotosWidgetVideoLink link={newImg.productUrl} />) }

          { newImg.videoUrl && !isIOS ? (<PhotosWidgetVideo src={newImg.videoUrl} img={newImg.imgUrl} />) : ''}

          { newImg.imgUrl && (<PhotosWidgetPhotoItem photo={newImg} isIOS={isIOS} />) }

        </div>
      </div>
    );
  }
}

export class PhotosWidgetPhotoItem extends Component {
  ref = createRef()
  canvas = null
  ctx = null
  opacity = 0
  loadedImg = null

  onLoaded(img) {
    console.log('Loaded img', img);
    this.loadedImg = img;
    this.opacity = 0;
    this.fadeIn();
  }

  scaleToFit(img){
    // get the scale
    let scale = Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
    // get the top left position of the image
    let x = (this.canvas.width / 2) - (img.width / 2) * scale;
    let y = (this.canvas.height / 2) - (img.height / 2) * scale;
    let w = img.width * scale;
    let h = img.height * scale;
    this.ctx.drawImage(img, x, y, w, h);

    return {
      x,
      y,
      w,
      h
    }
  }

  scaleToFill(img){
    // get the scale
    let scale = Math.max(this.canvas.width / img.width, this.canvas.height / img.height);
    // get the top left position of the image
    let x = (this.canvas.width / 2) - (img.width / 2) * scale;
    let y = (this.canvas.height / 2) - (img.height / 2) * scale;
    let w = img.width * scale;
    let h = img.height * scale;
    this.ctx.drawImage(img, x, y, w, h);

    return {
      x,
      y,
      w,
      h
    }
  }

  draw() {
    let img = this.loadedImg;
    let params;
    if (img.width >= img.height) {
      params = this.scaleToFill(img);
    } else {
      params = this.scaleToFit(img);
    }
    // cover up sides
    this.ctx.fillRect(0, 0, (this.canvas.width - params.w)/2, this.canvas.height);
    this.ctx.fillRect(params.x + params.w, 0, (this.canvas.width - params.w)/2, this.canvas.height);
  }

  fadeIn() {
    this.ctx.globalAlpha = this.opacity;
    this.draw()

    this.opacity += 0.01;
    if (this.opacity < 1)
      global.requestAnimationFrame(() => this.fadeIn());
    else
      this.isBusy = false;
  }

  componentDidMount() {
    if (this.ref.current) {
      this.canvas = this.ref.current;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.fillStyle = '#fff';
    }
  }

  render({photo, newImg, isIOS}, {loadedImgUrl}) {
    let img = new global.Image();
    // img.crossOrigin = "Anonymous";
    img.onload = this.onLoaded.bind(this, img);
    img.src = photo.imgUrl;

    return (
      <div class={style.photo}>
        <canvas ref={this.ref} width={PHOTO_WIDTH} height={PHOTO_HEIGHT} class={style.canvas} />
      </div>
    )
  }
}

export class PhotosWidgetVideoLink extends Component {
  render({link}) {
    return (
      <a href={link} target="_blank" class={style.extLink} title="Open in a new window"></a>
    )
  }
}

export class PhotosWidgetVideo extends Component {
  state = {
    clicked: false,
    src: ''
  }
  ref = createRef()

  onClick() {
    this.setState({clicked: true});
    this.ref.current.play();
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.src != prevState.src) {
      return {
        clicked: false,
        src: nextProps.src
      }
    } else {
      return null;
    }
  }

  render({src, img}, {clicked}) {
    return (
      <div class={style.video_overlay} onClick={() => this.onClick()}>
        <video controls="true" type="video/mp4" ref={this.ref} src={src} poster={img} data-visible={clicked}  preload="none" class={style.video} />
      </div>
    );
  }
}
