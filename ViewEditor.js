import React, { Component, PropTypes } from 'react';
import {
  Dimensions,
  PanResponder,
  View,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';
import { distance, angle, center } from './utilities';
const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});

export class ViewEditor extends Component {
  static propTypes = {
    style: View.propTypes.style,
    imageHeight: PropTypes.number.isRequired,
    imageWidth: PropTypes.number.isRequired,
    imageContainerHeight: PropTypes.number,
    imageContainerWidth: PropTypes.number,
    imageMask: PropTypes.any,
    maskHeight: PropTypes.number,
    maskWidth: PropTypes.number,
    maskPadding: PropTypes.number,
    children: PropTypes.any,
    rotate: PropTypes.bool,
    panning: PropTypes.bool,
    // used for multi-images
    bigContainerWidth: PropTypes.number,
  }

  static defaultProps = {
    maskWidth: width,
    maskHeight: height,
    maskPadding: 0,
    imageContainerWidth: width,
    imageContainerHeight: height,
    rotate: false,
    panning: true,
  }

  constructor(props, context) {
    super(props, context);
    const relativeWidth = props.bigContainerWidth || props.imageContainerWidth
    this.state = {
      scale: new Animated.Value(relativeWidth / props.imageWidth),
      pan: new Animated.ValueXY(),
      angle: new Animated.Value('0deg'),
      animating: false,
      render: false,
    };
    this._panResponder = {};
    // panning variables
    this.panListener = null;
    this.currentPanValue = { x: 0, y: 0 };
    this._pan = { x: 0, y: 0 };
    // scaling variables
    this.scaleListener = null;
    this.currentScaleValue = 1;
    this._scale = relativeWidth / props.imageWidth;
    // angle variables
    this.angleListener = null;
    this.currentAngleValue = 0;
    this._angle = 0;
    // used for multiTouch
    this._previousDistance = 0;
    this._previousAngle = 0;
    this._previousCenter = 0;
    this._multiTouch = false;
    // methods
    this._handlePanResponderMove = this._handlePanResponderMove.bind(this);
    this._handlePanResponderEnd = this._handlePanResponderEnd.bind(this);
    this._updatePosition = this._updatePosition.bind(this);
    this._updateSize = this._updateSize.bind(this);
    this._checkAdjustment = this._checkAdjustment.bind(this);
    this._updatePanState = this._updatePanState.bind(this);

  }

  componentWillMount() {
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => !this.state.animating && this.props.panning,
      onMoveShouldSetPanResponder: () => !this.state.animating && this.props.panning,
      onPanResponderMove: this._handlePanResponderMove,
      onPanResponderRelease: this._handlePanResponderEnd,
      onPanResponderTerminate: this._handlePanResponderEnd,
    });
  }

  componentDidMount() {
    this.panListener = this.state.pan.addListener(value => this.currentPanValue = value);
    this.scaleListener = this.state.scale.addListener(value => this.currentScaleValue = value);
    this.angleListener = this.state.angle.addListener(value => this.currentAngleValue = value);
    this._checkAdjustment();
  }

  componentWillUnmount() {
    this.state.pan.removeListener(this.panListener);
    this.state.scale.removeListener(this.scaleListener);
    this.state.angle.removeListener(this.angleListener);
  }

  _updatePosition(x, y) {
    this.setState({ animating: true }, () => {
      Animated.timing(
        this.state.pan, {
          toValue: { x, y },
          easing: Easing.elastic(1),
          duration: 250
        }
      ).start(() => this._updatePanState())
    });
  }

  _updateSize(scale) {
    this.setState({ animating: true }, () => {
      Animated.timing(
        this.state.scale, {
          toValue: scale,
          easing: Easing.elastic(1),
          duration: 250
        }
      ).start(() => {
        this.setState({ animating: false });
        this._scale = this.currentScaleValue.value;
      });
    });
  }

  _updatePanState(x = this.currentPanValue.x, y = this.currentPanValue.y) {
    this.state.pan.setOffset({ x, y });
    this.state.pan.setValue({ x: 0, y: 0 });
    this.setState({ animating: false, render: true });
  }

  _handlePanResponderMove(e, gestureState) {
    const { imageContainerWidth, imageWidth, imageHeight } = this.props;
    if (gestureState.numberActiveTouches === 1 && !this._multiTouch) {
      return Animated.event([
        null, { dx: this.state.pan.x, dy: this.state.pan.y }
      ])(e, gestureState);
    } else if (gestureState.numberActiveTouches !== 1) {
      this._multiTouch = true;
      // set the intial values
      this._previousDistance = this._previousDistance === 0 ?
        distance(e.nativeEvent.touches) : this._previousDistance;
      this._previousAngle = this._previousAngle === 0 ?
        angle(e.nativeEvent.touches) : this._previousAngle;
      this._previousCenter = this._previousCenter === 0 ?
        center(e.nativeEvent.touches) : this._previousCenter;
      // angle calculations
      const angleChange = angle(e.nativeEvent.touches) - this._previousAngle;
      this.state.angle.setValue(
        `${parseFloat(this._angle) + angleChange}deg`
      );
      // zoom calculations
      const currentDistance = distance(e.nativeEvent.touches);
      const newScale = ((currentDistance - this._previousDistance + imageContainerWidth) / imageContainerWidth) * this._scale;
      this.state.scale.setValue(newScale);
      // zoom to the center of the touches
      // const currentCenter = center(e.nativeEvent.touches);
      // const newWidth = newScale * imageWidth;
      // const newHeight = newScale * imageHeight;
      // const currentX = this._pan.x > 0 || newWidth < imageWidth ?
      //   0 : this._pan.x;
      // const currentY = this._pan.y > 0 || newHeight < imageHeight ?
      //   0 : this._pan.y;
      // console.log('pan', this._pan);
      // const x = currentCenter.x - this._previousCenter.x + currentX;
      // const y = currentCenter.y - this._previousCenter.y + currentY;
      // this.state.pan.setOffset({ x, y });
      // return Animated.event([
      //   null, { dx: this.state.pan.x, dy: this.state.pan.y }
      // ])(e, gestureState);
    }
  }

  _handlePanResponderEnd() {
    const { imageWidth, imageHeight } = this.props;
    this._pan = this.currentPanValue;
    this._updatePanState();
    if (this._multiTouch) {
      this._scale = this.currentScaleValue.value;
      this._angle = this.currentAngleValue.value;
      this._multiTouch = false;
      this._previousDistance = 0;
      this._previousAngle = 0;
      this._previousCenter = 0;
      const { maskWidth, maskHeight } = this.props;
      if (imageWidth * this._scale < maskWidth) {
        this._updateSize(maskWidth / imageWidth);
      } else {
        this._checkAdjustment();
      }
    } else {
      this._checkAdjustment();
    }
  }

  _checkAdjustment() {
    const { imageContainerHeight, imageContainerWidth, maskPadding, imageHeight, imageWidth } = this.props;
    const positionUpdate = { x: 0, y: 0 };
    const imageAbove = this.currentPanValue.y + this._scale * imageHeight - imageContainerHeight + maskPadding;
    const imageLeft = this.currentPanValue.x + this._scale * imageWidth - imageContainerWidth + maskPadding;
    const additionalWidth = (imageWidth - this._scale * imageWidth) / 2;
    const additionalHeight = (imageHeight - this._scale * imageHeight) / 2;
    if (this.currentPanValue.x > maskPadding - additionalWidth) {
      positionUpdate.x = -this.currentPanValue.x - additionalWidth + maskPadding;
    }
    if (this.currentPanValue.y > maskPadding - additionalHeight) {
      positionUpdate.y = -this.currentPanValue.y - additionalHeight + maskPadding;
    }
    if (imageAbove < -additionalHeight) {
      positionUpdate.y = -imageAbove - additionalHeight;
    }
    if (imageLeft < -additionalWidth) {
      positionUpdate.x = -imageLeft - additionalWidth;
    }
    this._updatePosition(positionUpdate.x, positionUpdate.y);
  }

  render() {
    const { pan, scale, render } = this.state;
    const {
      imageWidth,
      imageHeight,
      imageContainerWidth,
      imageContainerHeight,
      imageMask,
      children,
      rotate,
      style,
      panning,
    } = this.props;
    const layout = pan.getLayout();
    const animatedStyle = {
      height: imageHeight,
      width: imageWidth,
      transform: [
        { translateX: layout.left },
        { translateY: layout.top },
        { scale }
      ]
    };
    if (rotate) {
      animatedStyle.transform.push({ rotate: this.state.angle });
    }
    return (
      <View
        style={[
          style,
          styles.container,
          { width: imageContainerWidth, height: imageContainerHeight }
        ]}
        {...this._panResponder.panHandlers}
      >
        <Animated.View
          style={animatedStyle}
        >
          {render && children()}
        </Animated.View>
        {imageMask && React.createElement(imageMask)}
      </View>
    );
  }
}
