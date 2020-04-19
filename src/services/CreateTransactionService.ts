import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  category: string;
  type: 'income' | 'outcome';
}
class CreateTransactionService {
  public async execute({
    title,
    value,
    category,
    type,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const total = await (await transactionsRepository.getBalance()).total;

    if (type === 'outcome' && total < value)
      throw new AppError('You can not spend what you do not have', 400);

    const categoryExists = await categoriesRepository.findOne({
      where: { title: category },
    });
    let category_id = '';

    if (!categoryExists) {
      const newCategory = categoriesRepository.create({ title: category });
      await categoriesRepository.save(newCategory);
      category_id = newCategory.id;
    } else {
      category_id = categoryExists.id;
    }
    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: {
        id: category_id,
        title: category,
      },
    });

    await transactionsRepository.save(transaction);
    return transaction;
  }
}

export default CreateTransactionService;
