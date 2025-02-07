//=== external helpers ====

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @providesModule shallowEqual
 * @typechecks
 * @flow
 */

/*eslint-disable no-self-compare */

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * inlined Object.is polyfill to avoid requiring consumers ship their own
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
 */
function is(x, y) {
  // SameValue algorithm
  if (x === y) {
    // Steps 1-5, 7-10
    // Steps 6.b-6.e: +0 != -0
    // Added the nonzero y check to make Flow happy, but it is redundant
    return x !== 0 || y !== 0 || 1 / x === 1 / y;
  } else {
    // Step 6.a: NaN == NaN
    return x !== x && y !== y;
  }
}

/**
 * Performs equality by iterating through keys on an object and returning false
 * when any key has values which are not strictly equal between the arguments.
 * Returns true when the values of all keys are strictly equal.
 */
function shallowEqual(objA, objB) {
  if (is(objA, objB)) {
    return true;
  }

  if (
    typeof objA !== 'object' ||
    objA === null ||
    typeof objB !== 'object' ||
    objB === null
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  // Test for A's keys different from B.
  for (let i = 0; i < keysA.length; i++) {
    if (
      !hasOwnProperty.call(objB, keysA[i]) ||
      !is(objA[keysA[i]], objB[keysA[i]])
    ) {
      return false;
    }
  }

  return true;
}

// === end of external helpers ===




const noop = () => {};

const utils = {
  //=== Move out of this object===

  isMounting: (status) => {
    return status === COMPONENT_STATE.MOUNTING;
  },
  isRerendering: (status) => {
    return status === COMPONENT_STATE.RE_RENDERING;
  },
  getHookUniqueId: (fn) => {
    return fn.__hookIds[fn.__currentHookPosition];
  },
  generateHookUniqueId: () => {
    return Date.now() * Math.random();
  },
  getHookValue: (currentComponent, hookUniqueId) => {
    return currentComponent.__hooks[hookUniqueId].value;
  },

  getCurrentHookPosition: (fn) => {
    return fn.__currentHookPosition;
  },
  // == specific to useMemo/useCallback/useEffect==
  getDependencyArray: (currentComponent, hookUniqueId) => {
    return currentComponent.__hooks[hookUniqueId].deps;
  },

  // specific to useEffect ===

  getCleanUpFn: (currentComponent, hookUniqueId) => {
    return currentComponent.__hooks[hookUniqueId].cleanupFn;
  },
  // xxx Do not touch xxx probably move out of this object
  __doNotTouchsetHookUniqueId: (fn, hookUniqueId) => {
    fn.__hookIds[fn.__currentHookPosition] = hookUniqueId;
  },
  __doNotTouchSetHookValue: (fn, hookUniquId, value) => {
    fn.__hooks[hookUniquId].value = value;
  },

  __doNotTouchIncreamentCurrentHookPosition: (currentComponent) => {
    return currentComponent.__currentHookPosition++;
  },
  __doNotTouchRegisterHookToComponent: (
    currentComponent,
    hookUniqueId,
    state
  ) => {
    currentComponent.__hooks[hookUniqueId] = {
      id: hookUniqueId,
      index: utils.getCurrentHookPosition(currentComponent),
      ...state,
    };
  },

  // == specific to useMemo/useCallback/useEffect==
  __doNotTouchSetDependencyArray: (
    currentComponent,
    hookUniqueId,
    depsArray
  ) => {
    currentComponent.__hooks[hookUniqueId].deps = depsArray;
  },

  //==specific to useEffect ==
  __doNotTouchSetCleanupFn: (currentComponent, hookUniqueId, cleanFn) => {
    currentComponent.__hooks[hookUniqueId].cleanFn = cleanFn;
  },

  //=== end of section to move out of this object ===
};

const COMPONENT_STATE = {
  MOUNTING: 'mounting',
  RE_RENDERING: 'rerendering',
  UN_MOUNTING: 'unmounting',
};

const ReactDOM = {
  rootElement: null,
  currentFunctionRender: '',
  render(element, fn) {
    this.currentFunctionRender = fn.__id;
    this.rootElement = element;
    this.rootElement.innerHTML = fn();
  },
};


const initalizeHook = (initialValue,type,{getPropsForHookRegistration=noop}={})=>{
  const currentComponent = React.getCurrentRunningComponent();
  let hookUniqueId;

  if (utils.isMounting(currentComponent.status)) {
    hookUniqueId = utils.generateHookUniqueId();

    const hookValue = {
      type,
      value:
        typeof initialValue === 'function' ? initialValue() : initialValue,
      ...(getPropsForHookRegistration() || {})
    };
    utils.__doNotTouchRegisterHookToComponent(
      currentComponent,
      hookUniqueId,
      hookValue
    );
    utils.__doNotTouchsetHookUniqueId(currentComponent, hookUniqueId);
  } else {
    hookUniqueId = utils.getHookUniqueId(currentComponent);
  }

  utils.__doNotTouchIncreamentCurrentHookPosition(currentComponent);

  return [utils.getHookValue(currentComponent, hookUniqueId),hookUniqueId]
}

const React = {
  rendererFunctions: {},
  batchedFunctionsForUpdates: new Set(),
  rafId: '',
  addToBatch: function (fnId) {
    !this.batchedFunctionsForUpdates.has(fnId) &&
      this.batchedFunctionsForUpdates.add(fnId);

    this.rerender();
  },

  createElement: function (fn) {
    function renderProxy(...args) {
      return fn.call(this, ...args);
    }

    const uniqueId = Date.now() * Math.random();

    renderProxy.__hooks = {};
    renderProxy.__hookIds = [];

    renderProxy.__id = uniqueId;
    renderProxy.__currentHookPosition = 0;
    renderProxy.status = COMPONENT_STATE.MOUNTING;
    renderProxy.__rerenderer = this.rerender;
    this.rendererFunctions[uniqueId] = renderProxy;
    return renderProxy;
  },

  rerender: function () {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.rafId = requestAnimationFrame(() => {
      for (let id of this.batchedFunctionsForUpdates) {
        const fn = this.rendererFunctions[id];
        this.currentFunctionRender = id;
        fn.__currentHookPosition = 0;
        fn.status = COMPONENT_STATE.RE_RENDERING;
        this.batchedFunctionsForUpdates.delete(id);
        React.render(fn);
      }
    });
  },
  render(fn) {
    ReactDOM.render(ReactDOM.rootElement, fn);
  },

  getCurrentRunningComponent: function () {
    let id = ReactDOM.currentFunctionRender;
    return React.rendererFunctions[id];
  },

  //hooks section

  useState: function (initialValue) {
  
    const [value,hookUniqueId] = initalizeHook(initialValue) 
  
    //make call at the inital point.

    let setter = function (params) {
      const currentComponent = React.getCurrentRunningComponent();
      const value = utils.getHookValue(currentComponent, hookUniqueId);
      const newValue = typeof params === 'function' ? params(value) : params;
      const isStateSame = value === newValue; //check logic for shallowEquals

      utils.__doNotTouchSetHookValue(currentComponent, hookUniqueId, newValue);

      if (!isStateSame) React.addToBatch(currentComponent.__id);
    };

    return [value, setter];
  },

  useRef: function (initialValue) {
    const [value] = initalizeHook({current:initialValue},"useRef");

    return value
  },

  useReducer: function (reducer, initArgs, initFn) {
    if (!initArgs) throw new Error('intialization args is manadatory');
    if (typeof reducer !== 'function')
      throw new Error('reducer should be a function');

    const [value,hookUniqueId] = initalizeHook(typeof initFn === "function" ? ()=>initFn(initArgs):initArgs,"useReducer")

   
    const setter = function (actionDetails) {
      const currentComponent = React.getCurrentRunningComponent();
      const value = utils.getHookValue(currentComponent, hookUniqueId);
      if (!actionDetails.type) throw new Error('Action must have type');

      const newValue = reducer(value, actionDetails);
      const isStateSame = shallowEqual(value, newValue);
      utils.__doNotTouchSetHookValue(currentComponent, hookUniqueId, newValue);

      if (!isStateSame) React.addToBatch(currentComponent.__id);
    };

    return [value, setter];
  },

  useMemo: function (fn, currentDeps) {
    const currentComponent = React.getCurrentRunningComponent();

    let hookUniqueId;
    //make call at the inital point.
    if (utils.isMounting(currentComponent.status)) {
      hookUniqueId = utils.generateHookUniqueId();

      const hookValue = {
        type: 'useMemo',
        value: fn(),
        deps: currentDeps,
      };
      utils.__doNotTouchRegisterHookToComponent(
        currentComponent,
        hookUniqueId,
        hookValue
      );
      utils.__doNotTouchsetHookUniqueId(currentComponent, hookUniqueId);
    } else {
      hookUniqueId = utils.getHookUniqueId(currentComponent);
    }

    utils.__doNotTouchIncreamentCurrentHookPosition(currentComponent);

    const previousDeps = utils.getDependencyArray(
      currentComponent,
      hookUniqueId
    );
    const isStateSame = shallowEqual(previousDeps, currentDeps);

    const value = isStateSame
      ? utils.getHookValue(currentComponent, hookUniqueId)
      : fn();

    if (!isStateSame) {
      utils.__doNotTouchSetHookValue(currentComponent, hookUniqueId, value);
      utils.__doNotTouchSetDependencyArray(
        currentComponent,
        hookUniqueId,
        currentDeps
      );
    }
    return value;
  },

  useCallback: function (fn, currentDeps) {
    const currentComponent = React.getCurrentRunningComponent();

    let hookUniqueId;
    //make call at the inital point.
    if (utils.isMounting(currentComponent.status)) {
      hookUniqueId = utils.generateHookUniqueId();

      const hookValue = {
        type: 'useCallback',
        value: fn,
        deps: currentDeps,
      };
      utils.__doNotTouchRegisterHookToComponent(
        currentComponent,
        hookUniqueId,
        hookValue
      );
      utils.__doNotTouchsetHookUniqueId(currentComponent, hookUniqueId);
    } else {
      hookUniqueId = utils.getHookUniqueId(currentComponent);
    }

    utils.__doNotTouchIncreamentCurrentHookPosition(currentComponent);

    const previousDeps = utils.getDependencyArray(
      currentComponent,
      hookUniqueId
    );
    const isStateSame = shallowEqual(previousDeps, currentDeps);

    const value = isStateSame
      ? utils.getHookValue(currentComponent, hookUniqueId)
      : fn;

    if (!isStateSame) {
      utils.__doNotTouchSetHookValue(currentComponent, hookUniqueId, value);
      utils.__doNotTouchSetDependencyArray(
        currentComponent,
        hookUniqueId,
        currentDeps
      );
    }
    return value;
  },

  //accepts a fn,depsArray
  // if fn returns a cleanup function then run it when
  useEffect: function (fn, currentDeps) {
    const currentComponent = React.getCurrentRunningComponent();

    let hookUniqueId;
    //make call at the inital point.
    if (utils.isMounting(currentComponent.status)) {
      hookUniqueId = utils.generateHookUniqueId();
      const cleanupFn = fn() || noop;

      const hookValue = {
        type: 'useEffect',
        value: fn,
        cleanupFn,
        deps: currentDeps,
      };
      utils.__doNotTouchRegisterHookToComponent(
        currentComponent,
        hookUniqueId,
        hookValue
      );
      utils.__doNotTouchsetHookUniqueId(currentComponent, hookUniqueId);
    } else {
      hookUniqueId = utils.getHookUniqueId(currentComponent);
    }

    utils.__doNotTouchIncreamentCurrentHookPosition(currentComponent);

    const previousDeps = utils.getDependencyArray(
      currentComponent,
      hookUniqueId
    );
    const isStateSame = shallowEqual(previousDeps, currentDeps);

    if (utils.isMounting(currentComponent.status) || !isStateSame) {
      let cleanUpFn =
        utils.getCleanUpFn(currentComponent, hookUniqueId) || noop;
      cleanUpFn();
      cleanUpFn = fn() || noop;
      utils.__doNotTouchSetDependencyArray(
        currentComponent,
        hookUniqueId,
        currentDeps
      );
      utils.__doNotTouchSetDependencyArray(
        currentComponent,
        hookUniqueId,
        cleanUpFn
      );
    }
  },
};

//Not implemented/tested more advanced cases
/**
 * --- useEffect ----
 * 1. Unmounting
 * 2. promises
 * 3. without deps
 *
 *
 */

const reducer = (state, action) => {
  switch (action.type) {
    case 'test': {
      return { count: state.count + 1 };
    }
  }
};

const initState = 2;

const initFunction = (ini) => {
  return {
    count: ini + 10,
  };
};

const test = () => {
  const [value, setValue] = React.useState(0);
  const [anotherValue, setAnotherValue] = React.useState(3);
  const [stateValue, setStateValue] = React.useReducer(
    reducer,
    initState,
    initFunction
  );

  const test = React.useRef({ a: 2 });

  const computedValue = React.useMemo(() => {
    console.log('useMemo runs...');
    return anotherValue + 4;
  }, [anotherValue]);

  const handleButtonClick = React.useCallback(() => {
    test.current.a = 4;
    setValue((prevValue) => prevValue + 1);
    setAnotherValue(anotherValue + 1);
    setStateValue({
      type: 'test',
    });
  }, []);

  React.useEffect(() => {
    console.log('rendering once..', value);
    return () => {
      console.log('Cleaning up...');
    };
  }, [value]);

  // const handleButtonClick = () => {
  //   test.current.a = 4;
  //   setValue((prevValue) => prevValue + 1);
  //   setAnotherValue(anotherValue + 1);
  //   setStateValue({
  //     type: 'test',
  //   });
  // };

  // const handleAnotherButtonClick = () => {
  //   setAnotherValue(anotherValue + 1);
  // };

  setTimeout(() => {
    document.getElementById('value').onclick = handleButtonClick;
    // document.getElementById('anotherValue').onclick = handleAnotherButtonClick;
  }, 0);

  return `<div>
  <div>Hello Value:- ${value}</div>
  <div>Hello AnotherValue:- ${anotherValue}</div>
  <div>Hello stateValue:- ${stateValue.count}</div>
  <div>Hello testRef:- ${test.current.a}</div>
  <div>Hello computedValue:- ${computedValue}</div>

  <button id="value" >increament</button>
  
</div>`;
};

ReactDOM.render(document.getElementById('app'), React.createElement(test));

// console.log('Hello');
