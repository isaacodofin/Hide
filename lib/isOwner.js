import settings from '../settings.js';

//import { isSudo } from './index.js';

async function isOwnerOrSudo(senderId) {

    // Get owner number from settings

    const ownerJid = settings.ownerNumber + "@s.whatsapp.net";

    if (senderId === ownerJid) return true;

    /**try {

        return await isSudo(senderId);

    } catch (e) {

        return false;

    }*/

}

export default isOwnerOrSudo;