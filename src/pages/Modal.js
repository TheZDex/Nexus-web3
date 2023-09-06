import { useEffect } from 'react';
import {createPortal} from 'react-dom';
let wrapperElement = null;
if (typeof window !== "undefined"){
    wrapperElement = document.createElement('div');
    document.body.appendChild(wrapperElement);
}
export const Modal = ({children,open, onClose}) => {
    if(!open){
        return null;
    }
    return createPortal(<div className='modal-wrapper'>{children}</div>,wrapperElement);
}
export default Modal;