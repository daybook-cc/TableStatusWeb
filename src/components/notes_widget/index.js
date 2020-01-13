import { h, Component } from 'preact';

import UserStorage from '../../lib/UserStorage';
import style from './style';

export default class NotesWidget extends Component {
  state = {
    text: ''
  };

  constructor(props) {
    super(props);
    this.storage = new UserStorage({
      prefix: 'STENGAZETA_NOTES'
    });
  }

  onChange(event) {
    let val = event.target.value;
    this.setState({text: val});
    this.storage.setItem( this.props.storageKey, val );
  }

  componentDidMount() {
    this.setState({
      text: this.storage.getItem( this.props.storageKey ) || ''
    });
  }

  render({}, { text }) {
    return (
      <div class={style.header}>
        <h1>{this.props.header}</h1>
        <div>
          <textarea onChange={e => this.onChange(e)}>{text}</textarea>
        </div>
      </div>
    );
  }
}
