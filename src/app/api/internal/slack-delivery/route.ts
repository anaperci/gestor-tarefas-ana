import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {withErrorHandling,ApiError} from '@/lib/api-error';
import {processCreationNotification} from '@/lib/slack-delivery';
export const POST=withErrorHandling(async request=>{
 const secret=process.env.SLACK_WORKER_SECRET;
 const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
 if(!secret || Buffer.byteLength(supplied)!==Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(secret),Buffer.from(supplied)))throw new ApiError('AUTH_REQUIRED','Acesso interno não autorizado');
 return NextResponse.json(await processCreationNotification());
});
