// lib/adminCheck.js

async function requireAdmin(context, customMessage = null) {

    const { reply, isSenderAdmin, isFromOwner, senderIsSudo, isGroup } = context;

    

    if (!isGroup) {

        await reply('❌ This command can only be used in groups!');

        return false;

    }

    

    if (!isSenderAdmin && !isFromOwner && !senderIsSudo) {

        const message = customMessage || '❌ Only group admins can use this command!';

        await reply(message);

        return false;

    }

    

    return true;

}

export { requireAdmin };