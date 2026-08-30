import { RequestResponse } from '../../http/dto/request.dto';
import { BoardRow } from '../../domain/entity/board-query';

/**
 * What a screen may know about a request.
 *
 * The author's id stays on the server (R-99): a screen has no use for it and it
 * is not ours to hand out. But a screen must still know whether the person
 * looking is the person who wrote it, or it cannot decide whether to offer Edit
 * and Delete (R-13, R-14, journey U-5).
 *
 * `isMine` is that answer and only that answer — the same shape a comment
 * already uses, so there is one way to ask the question (R-150).
 */
describe('a request as a screen sees it', () => {
  const author = '11111111-1111-4111-8111-111111111111';
  const somebodyElse = '22222222-2222-4222-8222-222222222222';

  const row: BoardRow = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Dark mode for the board',
    description: 'It is painful at night.',
    categoryId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    statusId: 'ssssssss-ssss-4sss-8sss-ssssssssssss',
    authorId: author,
    authorName: 'Sam',
    authorAvatarUrl: null,
    isPinned: false,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-02T11:30:00.000Z'),
    voteCount: 3,
    commentCount: 1,
    viewerHasVoted: false,
  };

  it('tells the person who wrote it that it is theirs', () => {
    expect(RequestResponse.from(row, author).isMine).toBe(true);
  });

  it('tells everybody else that it is not', () => {
    expect(RequestResponse.from(row, somebodyElse).isMine).toBe(false);
  });

  it('never sends the author id, whoever is asking', () => {
    const response = RequestResponse.from(row, author);

    expect(response).not.toHaveProperty('authorId');
    expect(JSON.stringify(response)).not.toContain(author);
  });

  it('sends when it was last edited, so a screen can say so', () => {
    expect(RequestResponse.from(row, author).updatedAt).toBe('2026-08-02T11:30:00.000Z');
  });

  it('sends the author only as a name and a picture (R-99)', () => {
    const response = RequestResponse.from(row, somebodyElse);

    expect(response.authorName).toBe('Sam');
    expect(response.authorAvatarUrl).toBeNull();
    expect(Object.keys(response).filter((key) => key.startsWith('author'))).toEqual([
      'authorName',
      'authorAvatarUrl',
    ]);
  });
});
